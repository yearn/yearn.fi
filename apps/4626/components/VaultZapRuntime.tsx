'use client'

import { getChain, SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { DemoWalletContext } from '@erc4626/lib/demoContext'
import { useYearnVaultMetadata } from '@erc4626/lib/useVaultDiscovery'
import { parseWalletCandidates } from '@erc4626/lib/vaultDiscovery'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import { WITHDRAW_COMMON_TOKENS_BY_CHAIN } from '@yearn/vault-widget/advanced'
import { useVaultWidgetSpotPrices } from '@yearn/vault-widget/internal/hooks/useVaultWidgetSpotPrices'
import { getKnownEnsoRouterAddress } from '@yearn/vault-widget/internal/utils/ensoRouters'
import { useVaultWidgetRuntime, VaultWidgetRuntimeProvider, type VaultWidgetToken } from '@yearn/vault-widget/runtime'
import { type ReactNode, useContext, useState } from 'react'
import { type Address, erc20Abi, formatUnits, isAddress } from 'viem'
import { useConfig } from 'wagmi'

const NATIVE: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const tokenKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`
const LISTS = ['etherscan', 'tokenlistooor'].map(
  (name) => `https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/${name}.json`
)
async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Unable to load wallet assets. Please retry.')
  return response.json()
}

/** Adapt this host's wallet and catalog to the shared widget's existing zap and token-selector flows. */
export function VaultZapRuntime({ chainId, children }: { chainId: number; children: ReactNode }) {
  const parent = useVaultWidgetRuntime()
  const demoWallet = useContext(DemoWalletContext)
  const config = useConfig()
  const queryClient = useQueryClient()
  const owner = parent.wallet.address
  const [enabled, setEnabled] = useState(false)
  const catalog = useYearnVaultMetadata(enabled)
  const lists = useQuery({
    queryKey: ['zap-token-lists'],
    enabled,
    staleTime: 3_600_000,
    queryFn: async ({ signal }) => {
      const results = await Promise.allSettled(LISTS.map((url) => fetchJson(url, signal)))
      const tokens = results.flatMap((result) =>
        result.status === 'fulfilled' && Array.isArray(result.value?.tokens) ? result.value.tokens : []
      )
      return tokens.flatMap((token: Record<string, unknown>): VaultWidgetToken[] =>
        typeof token.address === 'string' &&
        isAddress(token.address) &&
        Number.isInteger(token.chainId) &&
        Number.isInteger(token.decimals) &&
        Number(token.decimals) >= 0 &&
        Number(token.decimals) <= 255 &&
        typeof token.name === 'string' &&
        typeof token.symbol === 'string'
          ? [
              {
                address: token.address,
                chainId: Number(token.chainId),
                decimals: Number(token.decimals),
                name: token.name,
                symbol: token.symbol,
                balanceRaw: 0n,
                logoUri: typeof token.logoURI === 'string' ? token.logoURI : undefined
              }
            ]
          : []
      )
    }
  })
  const knownTokens = [
    ...(lists.data ?? []).filter((token) => !!getChain(token.chainId)),
    ...(catalog.data ?? []).flatMap((vault): VaultWidgetToken[] => [
      ...(vault.decimals !== undefined
        ? [
            {
              address: vault.address,
              chainId: vault.chainId,
              decimals: vault.decimals,
              name: vault.name,
              symbol: vault.symbol,
              balanceRaw: 0n
            }
          ]
        : []),
      ...(vault.assetAddress && vault.assetDecimals !== undefined
        ? [
            {
              address: vault.assetAddress,
              chainId: vault.chainId,
              decimals: vault.assetDecimals,
              name: vault.assetSymbol ?? 'Token',
              symbol: vault.assetSymbol ?? 'Token',
              balanceRaw: 0n
            }
          ]
        : [])
    ])
  ]
  const known = new Map(knownTokens.map((token) => [tokenKey(token.chainId, token.address), token]))
  const popular = useQuery({
    queryKey: ['zap-popular-token-metadata'],
    enabled: enabled && lists.isSuccess && catalog.isSuccess,
    staleTime: 3_600_000,
    queryFn: async () => {
      const results = await Promise.allSettled(
        SUPPORTED_CHAINS.flatMap((chain) =>
          (WITHDRAW_COMMON_TOKENS_BY_CHAIN[chain.id] ?? []).map(async (address) => {
            const cached = known.get(tokenKey(chain.id, address))
            if (cached) return cached
            const client = getPublicClient(config, { chainId: chain.id })
            if (!client) throw new Error('Network unavailable')
            const [decimals, name, symbol] = await Promise.all([
              client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
              client.readContract({ address, abi: erc20Abi, functionName: 'name' }),
              client.readContract({ address, abi: erc20Abi, functionName: 'symbol' })
            ])
            return { address, chainId: chain.id, decimals, name, symbol, balanceRaw: 0n } satisfies VaultWidgetToken
          })
        )
      )
      return {
        tokens: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
        unreadable: results.filter((result) => result.status === 'rejected').length
      }
    }
  })
  const wallet = useQuery({
    queryKey: ['zap-wallet-tokens', owner?.toLowerCase(), chainId, !!demoWallet],
    enabled: enabled && !!owner,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      if (!owner) throw new Error('Wallet is unavailable.')
      const refs = demoWallet
        ? demoWallet.getTokenReferences()
        : parseWalletCandidates(await fetchJson(`https://yearn.fi/api/enso/balances?eoaAddress=${owner}`, signal))
      const native = await Promise.allSettled(
        SUPPORTED_CHAINS.map(async (chain) => {
          const client = getPublicClient(config, { chainId: chain.id })
          if (!client) throw new Error('Wallet network unavailable')
          return {
            address: NATIVE,
            chainId: chain.id,
            ...chain.nativeCurrency,
            balanceRaw: await client.getBalance({ address: owner })
          } satisfies VaultWidgetToken
        })
      )
      const results = await Promise.allSettled(
        Array.from(
          new Map(
            refs
              .filter((token) => !!getChain(token.chainId))
              .map((token) => [tokenKey(token.chainId, token.address), token])
          ).values()
        ).map(async (ref) => {
          const client = getPublicClient(config, { chainId: ref.chainId })
          if (!client) throw new Error('Wallet network unavailable')
          const cached = known.get(tokenKey(ref.chainId, ref.address))
          const [balanceRaw, decimals, name, symbol] = await Promise.all([
            client.readContract({ address: ref.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
            cached?.decimals ?? client.readContract({ address: ref.address, abi: erc20Abi, functionName: 'decimals' }),
            cached?.name ?? client.readContract({ address: ref.address, abi: erc20Abi, functionName: 'name' }),
            cached?.symbol ?? client.readContract({ address: ref.address, abi: erc20Abi, functionName: 'symbol' })
          ])
          return { ...ref, decimals, name, symbol, balanceRaw } satisfies VaultWidgetToken
        })
      )
      return {
        tokens: [
          ...native.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
          ...results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
        ],
        unreadable: [...native, ...results].filter((result) => result.status === 'rejected').length
      }
    }
  })
  const { getUsdPrice } = useVaultWidgetSpotPrices(wallet.data?.tokens.filter((token) => token.balanceRaw > 0n) ?? [])
  const tokens = [
    ...knownTokens,
    ...(popular.data?.tokens ?? []),
    ...(wallet.data?.tokens ?? []).map((token) => ({
      ...token,
      usdValue: Number(formatUnits(token.balanceRaw, token.decimals)) * getUsdPrice(token)
    }))
  ]
  const byChain = Object.fromEntries(
    SUPPORTED_CHAINS.map((chain) => [
      chain.id,
      Object.fromEntries(
        tokens.filter((token) => token.chainId === chain.id).map((token) => [token.address.toLowerCase(), token])
      )
    ])
  )
  return (
    <VaultWidgetRuntimeProvider
      value={{
        routing: {
          ensoRouteEndpoint: 'https://yearn.fi/api/enso/route',
          fetchRoute: demoWallet?.fetchRoute,
          isEnsoEnabled: ({ chainId: target }) => target === chainId && !!getKnownEnsoRouterAddress(target),
          tokenSelectionChainIds: Array.from(
            new Set([
              chainId,
              ...(wallet.data?.tokens ?? [])
                .filter((token) => token.balanceRaw > 0n && !!getKnownEnsoRouterAddress(token.chainId))
                .map((token) => token.chainId)
            ])
          ),
          withdrawalTokenSelectionChainIds: SUPPORTED_CHAINS.map((chain) => chain.id)
        },
        catalog: {
          enableTokenList: () => setEnabled(true),
          isLoading: enabled && (lists.isPending || wallet.isPending),
          knownVaults: (catalog.data ?? []).flatMap((vault) =>
            vault.assetAddress
              ? [
                  {
                    address: vault.address,
                    assetAddress: vault.assetAddress,
                    chainId: vault.chainId,
                    hidden: vault.hidden
                  }
                ]
              : []
          ),
          tokenListsByChain: byChain
        },
        wallet: {
          tokensByChain: byChain,
          getToken: (ref) => byChain[ref.chainId]?.[ref.address.toLowerCase()],
          isLoading: enabled && wallet.isPending,
          hasCompletedLoad: wallet.isSuccess,
          refresh: async (refs) => {
            await parent.wallet.refresh(refs)
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['zap-wallet-tokens'] }),
              queryClient.invalidateQueries({ queryKey: ['tokens'] })
            ])
          }
        },
        prices: { getUsdPrice }
      }}
    >
      {children}
      {enabled && (wallet.isError || (wallet.data?.unreadable ?? 0) > 0) && (
        <p role="status" className="mx-auto mt-3 max-w-xl text-xs text-text-secondary">
          Some wallet assets could not be loaded.{' '}
          <button type="button" className="underline" onClick={() => void wallet.refetch()}>
            Retry
          </button>
        </p>
      )}
    </VaultWidgetRuntimeProvider>
  )
}
