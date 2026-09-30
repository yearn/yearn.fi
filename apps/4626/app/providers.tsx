'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { WalletActivityContext } from '@erc4626/components/WalletActivity'
import { getChain, resolveChainId } from '@erc4626/lib/chains'
import { getSafeTransactionDetails } from '@erc4626/lib/safe'
import { wagmiConfig } from '@erc4626/lib/wagmiConfig'
import { darkTheme, lightTheme, RainbowKitProvider, useConnectModal } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { useThemePreference } from '@yearn/site-header/theme'
import { type VaultWidgetRuntimeOverrides, VaultWidgetRuntimeProvider } from '@yearn/vault-widget'
import type {
  VaultWidgetNotificationInput,
  VaultWidgetNotificationStatus,
  VaultWidgetNotificationUpdate
} from '@yearn/vault-widget/runtime'
import { createWagmiVaultWidgetExecutionAdapter } from '@yearn/vault-widget/wagmi'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type { Hash } from 'viem'
import { useAccount, usePublicClient, WagmiProvider } from 'wagmi'

type TNotice = VaultWidgetNotificationInput & {
  id: string
  status: VaultWidgetNotificationStatus
  txHash?: Hash
  awaitingExecution?: boolean
  ownerAddress?: string
  createdAt: number
}
const refreshVaultReads = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['erc4626-vault'] }),
    queryClient.invalidateQueries({ queryKey: ['erc4626-wallet-vaults'] }),
    queryClient.invalidateQueries({ queryKey: ['readContract'] })
  ])

const execution = createWagmiVaultWidgetExecutionAdapter({
  config: wagmiConfig,
  resolveExecutionChainId: resolveChainId
})

function WidgetHost({ children }: { children: ReactNode }) {
  const { address, chainId, connector, isConnecting, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const queryClient = useQueryClient()
  const [notices, setNotices] = useState<TNotice[]>([])
  const create = useCallback(
    async (
      input: VaultWidgetNotificationInput &
        Partial<Pick<TNotice, 'txHash' | 'status' | 'awaitingExecution' | 'ownerAddress'>>
    ) => {
      const id = crypto.randomUUID()
      setNotices((previous) =>
        [
          {
            ...input,
            id,
            ownerAddress: input.ownerAddress ?? address,
            createdAt: Math.floor(Date.now() / 1000),
            status: input.status ?? 'pending'
          },
          ...previous
        ].slice(0, 10)
      )
      return id
    },
    [address]
  )
  const update = useCallback(async (input: VaultWidgetNotificationUpdate) => {
    setNotices((previous) =>
      previous.map((notice) =>
        notice.id === input.id
          ? {
              ...notice,
              status: input.receipt
                ? input.receipt.status === 'success'
                  ? 'success'
                  : 'error'
                : (input.status ?? notice.status),
              txHash: input.txHash ?? notice.txHash,
              awaitingExecution: input.receipt ? false : (input.awaitingExecution ?? notice.awaitingExecution)
            }
          : notice
      )
    )
  }, [])
  const runtime = useMemo<VaultWidgetRuntimeOverrides>(
    () => ({
      wallet: {
        address,
        chainId,
        connected: isConnected,
        connecting: isConnecting,
        open: () => openConnectModal?.(),
        refresh: () => refreshVaultReads(queryClient)
      },
      chains: {
        resolveExecutionChainId: resolveChainId,
        resolveCanonicalChainId: resolveChainId,
        isConnectedToExecutionChain: (connected, target) => connected === target,
        getChain: (id) => {
          const chain = getChain(id)
          return chain ? { id, name: chain.name, blockExplorerUrl: chain.blockExplorers?.default.url } : undefined
        }
      },
      execution,
      safe: {
        isSafe: connector?.id.toLowerCase().includes('safe') === true,
        getTransactionDetails: getSafeTransactionDetails
      },
      notifications: {
        create,
        createSubmitted: create,
        update,
        get: (id) => notices.find((notice) => notice.id === id)
      },
      assets: { baseUri: 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main' },
      routing: { isEnsoEnabled: () => false }
    }),
    [address, chainId, connector?.id, create, isConnected, isConnecting, notices, openConnectModal, queryClient, update]
  )
  return (
    <VaultWidgetRuntimeProvider value={runtime}>
      <WalletActivityContext.Provider
        value={notices.map((notice) => ({ ...notice, fromTokenName: notice.fromSymbol, timestamp: notice.createdAt }))}
      >
        {children}
      </WalletActivityContext.Provider>
      {notices.length > 0 && (
        <aside id="recent-transactions" aria-label="Recent transactions" className="mx-auto mb-12 w-full max-w-xl px-5">
          <h2 className="mb-3 text-sm font-semibold">Recent transactions</h2>
          <ul className="space-y-2">
            {notices.map((notice) => (
              <Notice key={notice.id} notice={notice} update={update} />
            ))}
          </ul>
        </aside>
      )}
    </VaultWidgetRuntimeProvider>
  )
}
function Notice({
  notice,
  update
}: {
  notice: TNotice
  update: (input: VaultWidgetNotificationUpdate) => Promise<void>
}) {
  const queryClient = useQueryClient()
  const pending = notice.status === 'pending' || notice.status === 'submitted'
  const safe = useQuery({
    queryKey: ['4626-safe-notice', notice.txHash],
    queryFn: () => getSafeTransactionDetails(notice.txHash!),
    enabled: pending && !!notice.awaitingExecution && !!notice.txHash,
    refetchInterval: pending ? 3_000 : false
  })
  const hash = notice.awaitingExecution ? safe.data?.executionTxHash : notice.txHash
  const [replacement, setReplacement] = useState<'repriced' | 'cancelled' | 'replaced'>()
  const client = usePublicClient({ chainId: notice.fromChainId })
  const receipt = useQuery({
    queryKey: ['4626-notice-receipt', notice.fromChainId, hash],
    enabled: pending && !!hash && !!client,
    // Viem returns reverted receipts as data; Wagmi throws and discards that evidence.
    queryFn: () =>
      client!.waitForTransactionReceipt({
        hash: hash!,
        onReplaced: (event) => setReplacement(event.reason),
        confirmations: notice.fromChainId === 8453 ? 2 : 1
      }),
    retry: false,
    refetchInterval: pending ? 3_000 : false
  })
  // Receipt/Safe updates arrive outside UI events. Reconcile host notices even if the widget was unmounted.
  useEffect(() => {
    if (!pending) return
    if (replacement === 'cancelled' || replacement === 'replaced') {
      void update({ id: notice.id, status: 'error' })
    } else if (receipt.data) {
      void update({ id: notice.id, receipt: receipt.data, txHash: receipt.data.transactionHash })
      void refreshVaultReads(queryClient)
    } else if (safe.data?.status === 'failed' || safe.data?.status === 'cancelled') {
      void update({ id: notice.id, status: 'error' })
    }
  }, [notice.id, pending, queryClient, receipt.data, replacement, safe.data?.status, update])
  const explorer = getChain(notice.fromChainId)?.blockExplorers?.default.url
  const label =
    notice.status === 'success'
      ? 'Confirmed'
      : notice.status === 'error'
        ? 'Failed'
        : notice.awaitingExecution
          ? 'Awaiting Safe execution'
          : 'Pending'
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
      <span className="capitalize">
        {notice.type} · {label}
      </span>
      {hash && explorer && (
        <a href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer" className="underline">
          View transaction
        </a>
      )}
    </li>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const theme = useThemePreference() === 'light' ? lightTheme : darkTheme
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme({ accentColor: '#0657f9', borderRadius: 'medium' })}>
          <WidgetHost>{children}</WidgetHost>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
