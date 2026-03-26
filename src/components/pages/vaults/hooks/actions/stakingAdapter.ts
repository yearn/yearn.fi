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
  redeemAll?: boolean
  maxRedeemShares?: bigint
}

type StakingWithdrawableAssetsInput = {
  read: (request: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
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

export function getRedeemPreviewCall(stakingSource: string | undefined, amount: bigint): StakingCall | undefined {
  const source = normalizeStakingSource(stakingSource)
  if (source === 'VeYFI') {
    return {
      abi: VEYFI_GAUGE_ABI,
      functionName: 'previewRedeem',
      args: [amount]
    }
  }
  if (source === 'yBOLD') {
    return {
      abi: TOKENIZED_STRATEGY_ABI,
      functionName: 'previewRedeem',
      args: [amount]
    }
  }
  return undefined
}

export function getStakingConvertToAssetsCall(
  stakingSource: string | undefined,
  shares: bigint
): StakingCall | undefined {
  const source = normalizeStakingSource(stakingSource)
  if (source === 'VeYFI') {
    return {
      abi: VEYFI_GAUGE_ABI,
      functionName: 'convertToAssets',
      args: [shares]
    }
  }
  if (source === 'yBOLD') {
    return {
      abi: TOKENIZED_STRATEGY_ABI,
      functionName: 'convertToAssets',
      args: [shares]
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

export function getDirectUnstakeCalls({
  stakingSource,
  amount,
  account,
  redeemAll,
  maxRedeemShares
}: DirectUnstakeCallInput): {
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

  const shouldRedeemAll = !!account && !!redeemAll && (maxRedeemShares ?? 0n) > 0n
  const redeemShares = maxRedeemShares ?? 0n

  if (source === 'VeYFI') {
    return {
      primary: shouldRedeemAll
        ? {
            abi: VEYFI_GAUGE_ABI,
            functionName: 'redeem',
            args: [redeemShares, account, account]
          }
        : account
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
      primary: shouldRedeemAll
        ? {
            abi: TOKENIZED_STRATEGY_ABI,
            functionName: 'redeem',
            args: [redeemShares, account, account]
          }
        : account
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
  read,
  address,
  abi,
  functionName,
  args
}: {
  read: (request: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
  address: Address
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}): Promise<bigint | undefined> {
  try {
    const value = await read({
      address,
      abi,
      functionName,
      args
    })
    return BigInt(value as bigint)
  } catch {
    return undefined
  }
}

async function readMaxRedeemConvertedAssets({
  read,
  address,
  abi,
  account
}: {
  read: (request: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
  address: Address
  abi: readonly unknown[]
  account: Address
}): Promise<bigint | undefined> {
  const maxRedeem = await readBigInt({
    read,
    address,
    abi,
    functionName: 'maxRedeem',
    args: [account]
  })
  if (maxRedeem === undefined) {
    return undefined
  }

  return readBigInt({
    read,
    address,
    abi,
    functionName: 'convertToAssets',
    args: [maxRedeem]
  })
}

export async function getStakingWithdrawableAssets({
  read,
  stakingAddress,
  account,
  stakingSource,
  stakingShareBalance
}: StakingWithdrawableAssetsInput): Promise<bigint> {
  const source = normalizeStakingSource(stakingSource)

  const mappedAbi = source === 'VeYFI' ? VEYFI_GAUGE_ABI : source === 'yBOLD' ? TOKENIZED_STRATEGY_ABI : undefined

  if (mappedAbi) {
    const mappedRedeemableAssets = await readMaxRedeemConvertedAssets({
      read,
      address: stakingAddress,
      abi: mappedAbi,
      account
    })
    if (mappedRedeemableAssets !== undefined) {
      return mappedRedeemableAssets
    }

    const mappedMaxWithdraw = await readBigInt({
      read,
      address: stakingAddress,
      abi: mappedAbi,
      functionName: 'maxWithdraw',
      args: [account]
    })
    if (mappedMaxWithdraw !== undefined) {
      return mappedMaxWithdraw
    }

    const mappedConvertedAssets = await readBigInt({
      read,
      address: stakingAddress,
      abi: mappedAbi,
      functionName: 'convertToAssets',
      args: [stakingShareBalance]
    })
    if (mappedConvertedAssets !== undefined) {
      return mappedConvertedAssets
    }
  }

  const genericRedeemableAssets = await readMaxRedeemConvertedAssets({
    read,
    address: stakingAddress,
    abi: erc4626Abi,
    account
  })
  if (genericRedeemableAssets !== undefined) {
    return genericRedeemableAssets
  }

  const genericMaxWithdraw = await readBigInt({
    read,
    address: stakingAddress,
    abi: erc4626Abi,
    functionName: 'maxWithdraw',
    args: [account]
  })
  if (genericMaxWithdraw !== undefined) {
    return genericMaxWithdraw
  }

  const genericConvertedAssets = await readBigInt({
    read,
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

export async function getStakingRedeemableShares({
  read,
  stakingAddress,
  account,
  stakingSource,
  stakingShareBalance
}: StakingWithdrawableAssetsInput): Promise<bigint> {
  const source = normalizeStakingSource(stakingSource)

  const mappedAbi = source === 'VeYFI' ? VEYFI_GAUGE_ABI : source === 'yBOLD' ? TOKENIZED_STRATEGY_ABI : undefined

  if (mappedAbi) {
    const mappedMaxRedeem = await readBigInt({
      read,
      address: stakingAddress,
      abi: mappedAbi,
      functionName: 'maxRedeem',
      args: [account]
    })
    if (mappedMaxRedeem !== undefined) {
      return mappedMaxRedeem
    }
  }

  const genericMaxRedeem = await readBigInt({
    read,
    address: stakingAddress,
    abi: erc4626Abi,
    functionName: 'maxRedeem',
    args: [account]
  })
  if (genericMaxRedeem !== undefined) {
    return genericMaxRedeem
  }

  return stakingShareBalance
}
