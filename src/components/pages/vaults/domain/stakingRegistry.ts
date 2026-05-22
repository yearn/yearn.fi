import { toAddress } from '@shared/utils'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'

export type StakingSourceKind = 'VeYFI' | 'yBOLD' | 'default'
export type StakingFunctionSelector =
  | 'deposit(uint256)'
  | 'deposit(uint256,address)'
  | 'stake(uint256)'
  | 'withdraw(uint256)'
  | 'withdraw(uint256,address,address)'
  | 'redeem(uint256,address,address)'
  | 'earned(address)'
  | 'earned(address,address)'
  | 'earnedMulti(address)'
  | 'getReward()'

export type StakingRegistryEntry = {
  chainId: number
  address: Address
  source: StakingSourceKind
  adapter: 'tokenizedStrategy' | 'veYFIGauge' | 'stakingRewards'
  selectors: readonly StakingFunctionSelector[]
}

const STAKING_REGISTRY: readonly StakingRegistryEntry[] = [
  {
    chainId: 1,
    address: '0x23346B04a7f55b8760E5860AA5A77383D63491cD',
    source: 'yBOLD',
    adapter: 'tokenizedStrategy',
    selectors: ['deposit(uint256,address)', 'withdraw(uint256,address,address)', 'redeem(uint256,address,address)']
  }
]

const normalizeRegistryStakingSource = (stakingSource?: string): StakingSourceKind => {
  if (stakingSource === 'VeYFI') return 'VeYFI'
  if (stakingSource === 'yBOLD') return 'yBOLD'
  return 'default'
}

export function getRegisteredStakingContract({
  chainId,
  stakingAddress,
  stakingSource
}: {
  chainId?: number
  stakingAddress?: Address | string
  stakingSource?: string
}): StakingRegistryEntry | undefined {
  if (!chainId || !stakingAddress || toAddress(stakingAddress) === zeroAddress) {
    return undefined
  }

  const normalizedAddress = toAddress(stakingAddress)
  const normalizedSource = normalizeRegistryStakingSource(stakingSource)

  return STAKING_REGISTRY.find(
    (entry) =>
      entry.chainId === chainId && toAddress(entry.address) === normalizedAddress && entry.source === normalizedSource
  )
}

export function isRegisteredStakingContract(params: {
  chainId?: number
  stakingAddress?: Address | string
  stakingSource?: string
}): boolean {
  return !!getRegisteredStakingContract(params)
}

export function hasRegisteredStakingSelector(params: {
  chainId?: number
  stakingAddress?: Address | string
  stakingSource?: string
  selector: StakingFunctionSelector
}): boolean {
  return !!getRegisteredStakingContract(params)?.selectors.includes(params.selector)
}
