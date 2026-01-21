import type { Address } from 'viem'
import { useReadContract } from 'wagmi'

const DOMAIN_SEPARATOR_ABI = [
  {
    name: 'DOMAIN_SEPARATOR',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view'
  }
] as const

interface UsePermitSupportProps {
  vaultAddress: Address
  chainId: number
  enabled?: boolean
}

interface UsePermitSupportReturn {
  supportsPermit: boolean
  isLoading: boolean
}

export const usePermitSupport = ({
  vaultAddress,
  chainId,
  enabled = true
}: UsePermitSupportProps): UsePermitSupportReturn => {
  const { data: domainSeparator, isLoading } = useReadContract({
    address: vaultAddress,
    abi: DOMAIN_SEPARATOR_ABI,
    functionName: 'DOMAIN_SEPARATOR',
    chainId,
    query: { enabled: enabled && !!vaultAddress }
  })

  return {
    supportsPermit: !!domainSeparator,
    isLoading
  }
}
