import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCapabilities } from '@wagmi/core'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { Address } from 'viem'
import { useAccount, useConfig } from 'wagmi'

type TAtomicCapability = {
  rejected?: boolean
  atomic?: {
    status?: unknown
  }
}

export function supportsAtomicBatch(capabilities: unknown): boolean {
  if (!capabilities || typeof capabilities !== 'object') {
    return false
  }

  const status = (capabilities as TAtomicCapability).atomic?.status
  return status === 'supported' || status === 'ready'
}

export function useAtomicBatchCapability({
  account,
  chainId,
  enabled = true
}: {
  account?: Address
  chainId: number
  enabled?: boolean
}): { supported: boolean; status: string; disableBatch: () => Promise<void> } {
  const { address: connectedAccount, connector, status: accountStatus } = useAccount()
  const config = useConfig()
  const queryClient = useQueryClient()
  const runtime = useVaultWidgetRuntime()
  const executionChainId = runtime.chains.resolveExecutionChainId(chainId) ?? chainId
  const canQuery = Boolean(
    enabled &&
      account &&
      account.toLowerCase() === connectedAccount?.toLowerCase() &&
      connector &&
      accountStatus === 'connected'
  )
  const queryKey = ['vault-widget', 'atomic-capabilities', account, executionChainId, connector?.uid] as const
  const capabilities = useQuery({
    queryKey,
    queryFn: async (): Promise<TAtomicCapability | null> =>
      (await getCapabilities(config, { account, chainId: executionChainId, connector })) ?? null,
    enabled: canQuery,
    retry: false,
    staleTime: (query) => (query.state.data?.rejected ? Infinity : 30_000)
  })

  const status = !canQuery
    ? 'unknown'
    : capabilities.isError
      ? 'error'
      : capabilities.isPending
        ? 'pending'
        : supportsAtomicBatch(capabilities.data)
          ? String((capabilities.data as TAtomicCapability).atomic?.status)
          : 'unsupported'
  return {
    supported: canQuery && !capabilities.isError && supportsAtomicBatch(capabilities.data),
    status,
    disableBatch: async () => {
      await queryClient.cancelQueries({ queryKey, exact: true })
      queryClient.setQueryData<TAtomicCapability>(queryKey, { atomic: { status: 'unsupported' }, rejected: true })
    }
  }
}
