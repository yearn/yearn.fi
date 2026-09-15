import { useQuery } from '@tanstack/react-query'
import { getCapabilities } from '@wagmi/core'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { Address } from 'viem'
import { useAccount, useConfig } from 'wagmi'

type TAtomicCapability = {
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

export function useAtomicBatchSupport({
  account,
  chainId,
  enabled = true
}: {
  account?: Address
  chainId: number
  enabled?: boolean
}): boolean {
  const { address: connectedAccount, connector, status } = useAccount()
  const config = useConfig()
  const runtime = useVaultWidgetRuntime()
  const executionChainId = runtime.chains.resolveExecutionChainId(chainId) ?? chainId
  const canQuery = Boolean(
    enabled &&
      account &&
      account.toLowerCase() === connectedAccount?.toLowerCase() &&
      connector &&
      status === 'connected'
  )
  const capabilities = useQuery({
    queryKey: ['vault-widget', 'atomic-capabilities', account, executionChainId, connector?.uid],
    queryFn: () => getCapabilities(config, { account, chainId: executionChainId, connector }),
    enabled: canQuery,
    retry: false,
    staleTime: 30_000
  })

  return canQuery && !capabilities.isError && supportsAtomicBatch(capabilities.data)
}
