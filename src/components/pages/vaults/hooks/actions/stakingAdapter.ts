import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { STAKING_REWARDS_ABI } from '@shared/contracts/abi/stakingRewards.abi'
import { TOKENIZED_STRATEGY_ABI } from '@shared/contracts/abi/tokenizedStrategy.abi'
import { VEYFI_GAUGE_ABI } from '@shared/contracts/abi/veYFIGauge.abi'
import type { Address } from 'viem'

export type StakingSourceKind = 'VeYFI' | 'yBOLD' | 'default'

export type StakingCall = {
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}

type DirectStakeCallInput = {
  stakingSource?: string
  amount: bigint
  account?: Address
}

type DirectUnstakeCallInput = {
  stakingSource?: string
  amount: bigint
  account?: Address
}

type StakingWithdrawableAssetsInput = {
  client: {
    readContract: (request: unknown) => Promise<unknown>
  }
  stakingAddress: Address
  account: Address
  stakingSource?: string
  stakingShareBalance: bigint
}

export function normalizeStakingSource(stakingSource?: string): StakingSourceKind {
  if (stakingSource === 'VeYFI') return 'VeYFI'
  if (stakingSource === 'yBOLD') return 'yBOLD'
  return 'default'
}

export function getStakePreviewCall(stakingSource: string | undefined, amount: bigint): StakingCall | undefined {
  const source = normalizeStakingSource(stakingSource)
  if (source === 'VeYFI') {
    return {
      abi: VEYFI_GAUGE_ABI,
      functionName: 'previewDeposit',
      args: [amount]
    }
  }
  if (source === 'yBOLD') {
    return {
      abi: TOKENIZED_STRATEGY_ABI,
      functionName: 'previewDeposit',
      args: [amount]
    }
  }
  return undefined
}

export function getDirectStakeCall({ stakingSource, amount, account }: DirectStakeCallInput): StakingCall {
  const source = normalizeStakingSource(stakingSource)

  if (source === 'VeYFI') {
    return {
      abi: VEYFI_GAUGE_ABI,
      functionName: 'deposit',
      args: [amount]
    }
  }

  if (source === 'yBOLD') {
    return {
      abi: TOKENIZED_STRATEGY_ABI,
      functionName: 'deposit',
      args: account ? [amount, account] : undefined
    }
  }

  return {
    abi: STAKING_REWARDS_ABI,
    functionName: 'stake',
    args: [amount]
  }
}

export function getDirectUnstakeCalls({ stakingSource, amount, account }: DirectUnstakeCallInput): {
  primary: StakingCall
  fallback?: StakingCall
} {
  const source = normalizeStakingSource(stakingSource)

  const erc4626Call: StakingCall | undefined = account
    ? {
        abi: erc4626Abi,
        functionName: 'withdraw',
        args: [amount, account, account]
      }
    : undefined

  const rewardsCall: StakingCall = {
    abi: STAKING_REWARDS_ABI,
    functionName: 'withdraw',
    args: [amount]
  }

  if (source === 'VeYFI') {
    return {
      primary: account
        ? {
            abi: VEYFI_GAUGE_ABI,
            functionName: 'withdraw',
            args: [amount, account, account]
          }
        : rewardsCall,
      fallback: rewardsCall
    }
  }

  if (source === 'yBOLD') {
    return {
      primary: account
        ? {
            abi: TOKENIZED_STRATEGY_ABI,
            functionName: 'withdraw',
            args: [amount, account, account]
          }
        : rewardsCall,
      fallback: rewardsCall
    }
  }

  return {
    primary: rewardsCall,
    fallback: erc4626Call
  }
}

async function readBigInt({
  client,
  address,
  abi,
  functionName,
  args
}: {
  client: {
    readContract: (request: unknown) => Promise<unknown>
  }
  address: Address
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}): Promise<bigint | undefined> {
  try {
    const value = await client.readContract({
      address,
      abi: abi as any,
      functionName: functionName as any,
      args: args as any
    })
    return BigInt(value as bigint)
  } catch {
    return undefined
  }
}

export async function getStakingWithdrawableAssets({
  client,
  stakingAddress,
  account,
  stakingSource,
  stakingShareBalance
}: StakingWithdrawableAssetsInput): Promise<bigint> {
  const source = normalizeStakingSource(stakingSource)

  const mappedAbi = source === 'VeYFI' ? VEYFI_GAUGE_ABI : source === 'yBOLD' ? TOKENIZED_STRATEGY_ABI : undefined

  if (mappedAbi) {
    const mappedMaxWithdraw = await readBigInt({
      client,
      address: stakingAddress,
      abi: mappedAbi,
      functionName: 'maxWithdraw',
      args: [account]
    })
    if (mappedMaxWithdraw !== undefined) {
      return mappedMaxWithdraw
    }

    const mappedConvertedAssets = await readBigInt({
      client,
      address: stakingAddress,
      abi: mappedAbi,
      functionName: 'convertToAssets',
      args: [stakingShareBalance]
    })
    if (mappedConvertedAssets !== undefined) {
      return mappedConvertedAssets
    }
  }

  const genericMaxWithdraw = await readBigInt({
    client,
    address: stakingAddress,
    abi: erc4626Abi,
    functionName: 'maxWithdraw',
    args: [account]
  })
  if (genericMaxWithdraw !== undefined) {
    return genericMaxWithdraw
  }

  const genericConvertedAssets = await readBigInt({
    client,
    address: stakingAddress,
    abi: erc4626Abi,
    functionName: 'convertToAssets',
    args: [stakingShareBalance]
  })
  if (genericConvertedAssets !== undefined) {
    return genericConvertedAssets
  }

  return stakingShareBalance
}
