import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { STAKING_REWARDS_ABI } from '@shared/contracts/abi/stakingRewards.abi'
import { TOKENIZED_STRATEGY_ABI } from '@shared/contracts/abi/tokenizedStrategy.abi'
import { VEYFI_GAUGE_ABI } from '@shared/contracts/abi/veYFIGauge.abi'
import { describe, expect, it } from 'vitest'
import {
  getDirectStakeCall,
  getDirectUnstakeCalls,
  getRedeemPreviewCall,
  getStakePreviewCall,
  getStakingWithdrawableAssets,
  normalizeStakingSource
} from './stakingAdapter'

describe('stakingAdapter', () => {
  it('normalizes known and unknown staking sources', () => {
    expect(normalizeStakingSource('VeYFI')).toBe('VeYFI')
    expect(normalizeStakingSource('yBOLD')).toBe('yBOLD')
    expect(normalizeStakingSource('Legacy')).toBe('default')
  })

  it('builds stake preview calls for source-specific ERC4626 staking', () => {
    const amount = 42n
    expect(getStakePreviewCall('VeYFI', amount)).toMatchObject({
      abi: VEYFI_GAUGE_ABI,
      functionName: 'previewDeposit',
      args: [amount]
    })
    expect(getStakePreviewCall('yBOLD', amount)).toMatchObject({
      abi: TOKENIZED_STRATEGY_ABI,
      functionName: 'previewDeposit',
      args: [amount]
    })
    expect(getStakePreviewCall('Legacy', amount)).toBeUndefined()
  })

  it('builds redeem preview calls for vault-backed staking wrappers', () => {
    const shares = 42n
    expect(getRedeemPreviewCall('VeYFI', shares)).toMatchObject({
      abi: VEYFI_GAUGE_ABI,
      functionName: 'previewRedeem',
      args: [shares]
    })
    expect(getRedeemPreviewCall('yBOLD', shares)).toMatchObject({
      abi: TOKENIZED_STRATEGY_ABI,
      functionName: 'previewRedeem',
      args: [shares]
    })
    expect(getRedeemPreviewCall('Legacy', shares)).toBeUndefined()
  })

  it('builds direct stake calls per staking source', () => {
    const amount = 100n
    const account = '0x1111111111111111111111111111111111111111'

    expect(getDirectStakeCall({ stakingSource: 'VeYFI', amount, account })).toMatchObject({
      abi: VEYFI_GAUGE_ABI,
      functionName: 'deposit',
      args: [amount]
    })

    expect(getDirectStakeCall({ stakingSource: 'yBOLD', amount, account })).toMatchObject({
      abi: TOKENIZED_STRATEGY_ABI,
      functionName: 'deposit',
      args: [amount, account]
    })

    expect(getDirectStakeCall({ stakingSource: 'Legacy', amount, account })).toMatchObject({
      abi: STAKING_REWARDS_ABI,
      functionName: 'stake',
      args: [amount]
    })
  })

  it('builds direct unstake calls with source-first + fallback behavior', () => {
    const amount = 321n
    const account = '0x1111111111111111111111111111111111111111'

    const yboldCalls = getDirectUnstakeCalls({ stakingSource: 'yBOLD', amount, account })
    expect(yboldCalls.primary).toMatchObject({
      abi: TOKENIZED_STRATEGY_ABI,
      functionName: 'withdraw',
      args: [amount, account, account]
    })
    expect(yboldCalls.fallback).toMatchObject({
      abi: STAKING_REWARDS_ABI,
      functionName: 'withdraw',
      args: [amount]
    })

    const defaultCalls = getDirectUnstakeCalls({ stakingSource: 'Legacy', amount, account })
    expect(defaultCalls.primary).toMatchObject({
      abi: STAKING_REWARDS_ABI,
      functionName: 'withdraw',
      args: [amount]
    })
    expect(defaultCalls.fallback).toMatchObject({
      abi: erc4626Abi,
      functionName: 'withdraw',
      args: [amount, account, account]
    })
  })

  it('falls back to maxWithdraw when maxRedeem conversion is unavailable', async () => {
    const account = '0x1111111111111111111111111111111111111111'
    const stakingAddress = '0x2222222222222222222222222222222222222222'
    const read = async ({
      functionName
    }: {
      functionName: string
      address: `0x${string}`
      abi: readonly unknown[]
      args?: readonly unknown[]
    }) => {
      if (functionName === 'maxRedeem') throw new Error('missing')
      if (functionName === 'maxWithdraw') return 123n
      return 0n
    }

    const result = await getStakingWithdrawableAssets({
      read,
      stakingAddress,
      account,
      stakingSource: 'yBOLD',
      stakingShareBalance: 99n
    })

    expect(result).toBe(123n)
  })

  it('prefers maxRedeem + convertToAssets for ERC4626 wrappers', async () => {
    const account = '0x1111111111111111111111111111111111111111'
    const stakingAddress = '0x2222222222222222222222222222222222222222'
    const read = async ({
      functionName
    }: {
      functionName: string
      address: `0x${string}`
      abi: readonly unknown[]
      args?: readonly unknown[]
    }) => {
      if (functionName === 'maxRedeem') return 99n
      if (functionName === 'convertToAssets') return 150n
      if (functionName === 'maxWithdraw') return 123n
      return 0n
    }

    const result = await getStakingWithdrawableAssets({
      read,
      stakingAddress,
      account,
      stakingSource: 'yBOLD',
      stakingShareBalance: 99n
    })

    expect(result).toBe(150n)
  })

  it('falls back to convertToAssets and then raw balance for withdrawable assets', async () => {
    const account = '0x1111111111111111111111111111111111111111'
    const stakingAddress = '0x2222222222222222222222222222222222222222'

    const convertRead = async ({
      functionName
    }: {
      functionName: string
      address: `0x${string}`
      abi: readonly unknown[]
      args?: readonly unknown[]
    }) => {
      if (functionName === 'maxRedeem') {
        throw new Error('missing')
      }
      if (functionName === 'maxWithdraw') {
        throw new Error('missing')
      }
      if (functionName === 'convertToAssets') {
        return 456n
      }
      return 0n
    }

    const converted = await getStakingWithdrawableAssets({
      read: convertRead,
      stakingAddress,
      account,
      stakingSource: 'yBOLD',
      stakingShareBalance: 99n
    })
    expect(converted).toBe(456n)

    const failingRead = async () => {
      throw new Error('missing')
    }
    const fallback = await getStakingWithdrawableAssets({
      read: failingRead,
      stakingAddress,
      account,
      stakingSource: 'yBOLD',
      stakingShareBalance: 99n
    })
    expect(fallback).toBe(99n)
  })
})
