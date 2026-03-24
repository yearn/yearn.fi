import { describe, expect, it } from 'vitest'
import {
  buildLockedWithdrawNoZapExecutionPlan,
  buildLockedWithdrawTransactionStep,
  resolveLockedRequestedWithdrawAssets,
  resolveLockedWithdrawDisplayAmount,
  resolveLockedWithdrawExpectedOut
} from './YvUsdWithdraw.helpers'

const mockPrepare = (functionName: string, args: readonly unknown[]) =>
  ({
    isSuccess: true,
    data: {
      request: {
        functionName,
        args
      }
    }
  }) as any

describe('resolveLockedWithdrawDisplayAmount', () => {
  it('uses previewRedeem for the displayed max when it is available', () => {
    expect(
      resolveLockedWithdrawDisplayAmount({
        maxWithdrawAssets: 50_000000000000000000n,
        previewRedeemAssets: 51_000000n,
        unlockedPricePerShare: 1_020000n,
        unlockedVaultDecimals: 18
      })
    ).toBe(51_000000n)
  })

  it('falls back to price-per-share conversion when previewRedeem is unavailable', () => {
    expect(
      resolveLockedWithdrawDisplayAmount({
        maxWithdrawAssets: 50_000000000000000000n,
        unlockedPricePerShare: 1_020000n,
        unlockedVaultDecimals: 18
      })
    ).toBe(51_000000n)
  })
})

describe('resolveLockedRequestedWithdrawAssets', () => {
  it('snaps an exact max input back to the exact locked asset cap', () => {
    expect(
      resolveLockedRequestedWithdrawAssets({
        requestedDisplayAmount: 51_000000n,
        maxDisplayAmount: 51_000000n,
        maxWithdrawAssets: 50_000000000000000000n,
        previewWithdrawShares: 49_999999999999999999n
      })
    ).toBe(50_000000000000000000n)
  })

  it('uses previewWithdraw for partial requests and clamps them to the cap', () => {
    expect(
      resolveLockedRequestedWithdrawAssets({
        requestedDisplayAmount: 25_000000n,
        maxDisplayAmount: 51_000000n,
        maxWithdrawAssets: 50_000000000000000000n,
        previewWithdrawShares: 60_000000000000000000n
      })
    ).toBe(50_000000000000000000n)
  })
})

describe('resolveLockedWithdrawExpectedOut', () => {
  it('uses previewRedeem for the exact expected output when it is available', () => {
    expect(
      resolveLockedWithdrawExpectedOut({
        requestedLockedAssets: 25_000000000000000000n,
        previewRedeemAssets: 25_500000n,
        unlockedPricePerShare: 1_020000n,
        unlockedVaultDecimals: 18
      })
    ).toBe(25_500000n)
  })

  it('falls back to price-per-share conversion when previewRedeem is unavailable', () => {
    expect(
      resolveLockedWithdrawExpectedOut({
        requestedLockedAssets: 25_000000000000000000n,
        unlockedPricePerShare: 1_020000n,
        unlockedVaultDecimals: 18
      })
    ).toBe(25_500000n)
  })
})

describe('buildLockedWithdrawNoZapExecutionPlan', () => {
  it('builds a two-step no-zap execution plan with the same raw amount in both steps', () => {
    const plan = buildLockedWithdrawNoZapExecutionPlan({
      account: '0x1111111111111111111111111111111111111111',
      requestedLockedAssets: 50_000000000000000000n
    })

    expect(plan).toHaveLength(2)
    expect(plan[0]?.functionName).toBe('withdraw')
    expect(plan[1]?.functionName).toBe('redeem')
    expect(plan[0]?.args[0]).toBe(50_000000000000000000n)
    expect(plan[1]?.args[0]).toBe(50_000000000000000000n)
  })

  it('does not introduce an approval step for the locked no-zap flow', () => {
    const plan = buildLockedWithdrawNoZapExecutionPlan({
      account: '0x1111111111111111111111111111111111111111',
      requestedLockedAssets: 1n
    })

    expect(plan.map((step) => step.functionName)).toEqual(['withdraw', 'redeem'])
  })
})

describe('buildLockedWithdrawTransactionStep', () => {
  it('builds wrapper-owned withdraw and redeem overlay steps', () => {
    const withdrawStep = buildLockedWithdrawTransactionStep({
      phase: 'withdraw',
      prepareLockedWithdraw: mockPrepare('withdraw', [50n, '0x1', '0x1']),
      prepareUnlockedRedeem: mockPrepare('redeem', [50n, '0x1', '0x1']),
      requestedLockedAssets: 50_000000000000000000n,
      expectedUnderlyingOut: 51_000000n,
      lockedAssetDecimals: 18,
      underlyingDecimals: 6,
      lockedAssetSymbol: 'yvUSD',
      underlyingSymbol: 'USDC'
    })
    const redeemStep = buildLockedWithdrawTransactionStep({
      phase: 'redeem',
      prepareLockedWithdraw: mockPrepare('withdraw', [50n, '0x1', '0x1']),
      prepareUnlockedRedeem: mockPrepare('redeem', [50n, '0x1', '0x1']),
      requestedLockedAssets: 50_000000000000000000n,
      expectedUnderlyingOut: 51_000000n,
      lockedAssetDecimals: 18,
      underlyingDecimals: 6,
      lockedAssetSymbol: 'yvUSD',
      underlyingSymbol: 'USDC'
    })

    expect(withdrawStep.label).toBe('Withdraw to yvUSD')
    expect(redeemStep.label).toBe('Redeem to USDC')
    expect(withdrawStep.completesFlow).toBe(false)
    expect(redeemStep.completesFlow).toBe(true)
  })
})
