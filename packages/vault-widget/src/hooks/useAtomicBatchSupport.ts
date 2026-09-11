import type { Address } from 'viem'
import { useAccount, useCapabilities } from 'wagmi'

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
  const { connector } = useAccount()
  const capabilities = useCapabilities({
    account,
    chainId,
    connector,
    scopeKey: connector?.uid,
    query: {
      enabled: Boolean(enabled && account),
      retry: false,
      staleTime: Number.POSITIVE_INFINITY
    }
  })

  return supportsAtomicBatch(capabilities.data)
}
