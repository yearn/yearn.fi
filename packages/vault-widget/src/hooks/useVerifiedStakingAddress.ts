import { useQuery } from '@tanstack/react-query'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import { type Address, isAddress, isAddressEqual } from 'viem'
import { useConfig } from 'wagmi'
import { readContract } from 'wagmi/actions'

/*******************************************************************************
 ** Views that tie a supported staking contract to the vault it stakes:
 ** - asset(): VeYFI gauges and yBOLD staking (ERC-4626 style)
 ** - stakingToken(): V3 Staking, Juiced and OP Boost (StakingRewards style)
 ******************************************************************************/
const STAKING_UNDERLYING_ABI = [
  {
    type: 'function',
    name: 'asset',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    type: 'function',
    name: 'stakingToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  }
] as const

type TStakingUnderlyingFunction = (typeof STAKING_UNDERLYING_ABI)[number]['name']

export type TReadStakingUnderlying = (request: {
  address: Address
  abi: typeof STAKING_UNDERLYING_ABI
  functionName: TStakingUnderlyingFunction
}) => Promise<unknown>

export async function isStakingContractForVault({
  read,
  stakingAddress,
  vaultAddress
}: {
  read: TReadStakingUnderlying
  stakingAddress: Address
  vaultAddress: Address
}): Promise<boolean> {
  const results = await Promise.allSettled(
    STAKING_UNDERLYING_ABI.map(({ name }) =>
      read({ address: stakingAddress, abi: STAKING_UNDERLYING_ABI, functionName: name })
    )
  )

  if (results.every((result) => result.status === 'rejected')) {
    throw new Error(`Unable to read the staked token of ${stakingAddress}`)
  }

  return results.some(
    (result) =>
      result.status === 'fulfilled' &&
      typeof result.value === 'string' &&
      isAddress(result.value) &&
      isAddressEqual(result.value, vaultAddress)
  )
}

/*******************************************************************************
 ** Returns the staking address only once the contract has been verified
 ** on-chain to stake the given vault. Unverified, reverted or mismatching
 ** staking contracts resolve to undefined so no staking approval is built.
 ** Failed reads are not cached as a result, so a flaky RPC can be retried.
 ******************************************************************************/
export function useVerifiedStakingAddress({
  stakingAddress,
  vaultAddress,
  chainId
}: {
  stakingAddress?: Address
  vaultAddress: Address
  chainId: number
}): { verifiedStakingAddress?: Address; isVerifyingStaking: boolean } {
  const config = useConfig()
  const runtime = useVaultWidgetRuntime()
  const executionChainId = runtime.chains.resolveExecutionChainId(chainId)

  const { data: isVerified = false, isLoading } = useQuery({
    queryKey: ['staking-verification', executionChainId, stakingAddress?.toLowerCase(), vaultAddress.toLowerCase()],
    queryFn: () =>
      isStakingContractForVault({
        read: (request) => readContract(config, { ...request, chainId: executionChainId }),
        stakingAddress: stakingAddress as Address,
        vaultAddress
      }),
    enabled: !!stakingAddress && !!executionChainId,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 2,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  })

  return {
    verifiedStakingAddress: isVerified ? stakingAddress : undefined,
    isVerifyingStaking: isLoading
  }
}
