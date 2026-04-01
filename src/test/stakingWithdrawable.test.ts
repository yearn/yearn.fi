import { getStakingWithdrawableAssets } from '@pages/vaults/hooks/actions/stakingAdapter'
import { describe, expect, it } from 'vitest'

describe('getStakingWithdrawableAssets', () => {
  it('prefers maxRedeem + convertToAssets for ERC4626 wrappers', async () => {
    const result = await getStakingWithdrawableAssets({
      read: async ({
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
      },
      stakingAddress: '0x2222222222222222222222222222222222222222',
      account: '0x1111111111111111111111111111111111111111',
      stakingSource: 'yBOLD',
      stakingShareBalance: 99n
    })

    expect(result).toBe(150n)
  })

  it('falls back to maxWithdraw when maxRedeem conversion is unavailable', async () => {
    const result = await getStakingWithdrawableAssets({
      read: async ({
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
      },
      stakingAddress: '0x2222222222222222222222222222222222222222',
      account: '0x1111111111111111111111111111111111111111',
      stakingSource: 'yBOLD',
      stakingShareBalance: 99n
    })

    expect(result).toBe(123n)
  })

  it('falls back to convertToAssets then raw balance when maxRedeem and maxWithdraw both fail', async () => {
    const converted = await getStakingWithdrawableAssets({
      read: async ({
        functionName
      }: {
        functionName: string
        address: `0x${string}`
        abi: readonly unknown[]
        args?: readonly unknown[]
      }) => {
        if (functionName === 'maxRedeem') throw new Error('missing')
        if (functionName === 'maxWithdraw') throw new Error('missing')
        if (functionName === 'convertToAssets') return 456n
        return 0n
      },
      stakingAddress: '0x2222222222222222222222222222222222222222',
      account: '0x1111111111111111111111111111111111111111',
      stakingSource: 'yBOLD',
      stakingShareBalance: 99n
    })
    expect(converted).toBe(456n)

    const fallback = await getStakingWithdrawableAssets({
      read: async () => {
        throw new Error('missing')
      },
      stakingAddress: '0x2222222222222222222222222222222222222222',
      account: '0x1111111111111111111111111111111111111111',
      stakingSource: 'yBOLD',
      stakingShareBalance: 99n
    })
    expect(fallback).toBe(99n)
  })
})
