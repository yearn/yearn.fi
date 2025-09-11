import { useQuery } from '@tanstack/react-query'
import type { Abi, ContractFunctionName } from 'viem'
import type { ReadContractParameters, ReadContractsParameters } from 'wagmi/actions'
import { readContract, readContracts } from 'wagmi/actions'
import { retrieveConfig } from '../utils/wagmi'

/*******************************************************************************
 ** Chain-specific rate limiting configuration
 ******************************************************************************/
const CHAIN_RATE_LIMITS: Record<number, { staleTime: number; gcTime: number }> = {
  8453: { staleTime: 30 * 1000, gcTime: 5 * 60 * 1000 }, // Base: 30s stale, 5min cache
  1: { staleTime: 5 * 1000, gcTime: 60 * 1000 } // Mainnet: 5s stale, 1min cache
}

const DEFAULT_RATE_LIMIT = { staleTime: 5 * 1000, gcTime: 60 * 1000 }

/*******************************************************************************
 ** Get rate limit config for a specific chain
 ******************************************************************************/
function getRateLimitConfig(chainId: number) {
  return CHAIN_RATE_LIMITS[chainId] || DEFAULT_RATE_LIMIT
}

/*******************************************************************************
 ** Rate-limited single contract read hook
 ******************************************************************************/
export function useRateLimitedReadContract<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>
>(params: ReadContractParameters<TAbi, TFunctionName> & { enabled?: boolean }) {
  const { chainId, enabled = true, ...contractParams } = params
  const config = getRateLimitConfig(chainId || 1)

  return useQuery({
    queryKey: ['contract-read', chainId, contractParams.address, contractParams.functionName, contractParams.args],
    queryFn: async () => {
      return await readContract(retrieveConfig(), {
        ...contractParams,
        chainId
      } as any)
    },
    enabled,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
  })
}

/*******************************************************************************
 ** Rate-limited multiple contracts read hook
 ******************************************************************************/
export function useRateLimitedReadContracts<TContracts extends ReadContractsParameters['contracts']>(params: {
  contracts: TContracts
  enabled?: boolean
}) {
  const { contracts, enabled = true } = params
  const chainId = contracts[0]?.chainId || 1
  const config = getRateLimitConfig(chainId)

  return useQuery({
    queryKey: ['contracts-read', chainId, contracts],
    queryFn: async () => {
      // For Base chain, add a small delay between batched calls
      if (chainId === 8453) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return await readContracts(retrieveConfig(), { contracts } as any)
    },
    enabled,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
  })
}

/*******************************************************************************
 ** Hook to check if we should update based on block number for rate limiting
 ******************************************************************************/
export function useShouldUpdateOnBlock(blockNumber: bigint | undefined, chainId: number): boolean {
  if (!blockNumber) return false

  // For Base chain, only update every 10 blocks
  if (chainId === 8453) {
    return Number(blockNumber) % 10 === 0
  }

  // For other chains, update on every block
  return true
}
