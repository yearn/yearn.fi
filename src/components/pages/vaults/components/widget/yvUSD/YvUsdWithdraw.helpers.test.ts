import { describe, expect, it } from 'vitest'
import {
  buildLockedWithdrawNoZapExecutionPlan,
  buildLockedWithdrawTransactionStep,
  getLockedCooldownMaxAssetAmount,
  getLockedCooldownMaxDisplayAmount,
  resolveCooldownSharesToStart,
  resolveLockedRedeemAssets,
  resolveLockedRequestedAmountFromInput,
  resolveLockedRequestedWithdrawAssets,
  resolveLockedRequestedWithdrawShares,
  resolveLockedWithdrawDisplayAmount,
  resolveLockedWithdrawExpectedOut,
  resolveLockedWithdrawMethod,
  shouldNormalizeLockedWithdrawDisplayAmount
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

describe('resolveLockedRequestedWithdrawShares', () => {
  it('snaps an exact max asset request back to the exact redeemable share cap', () => {
    expect(
      resolveLockedRequestedWithdrawShares({
        requestedLockedAssets: 50_000000000000000000n,
        maxWithdrawAssets: 50_000000000000000000n,
        maxRedeemShares: 49_999999999999999999n,
        previewWithdrawShares: 49_900000000000000000n,
        lockedPricePerShare: 1_000000000000000000n,
        lockedVaultTokenDecimals: 18
      })
    ).toBe(49_999999999999999999n)
  })

  it('uses previewWithdraw shares for partial requests and clamps them to maxRedeem', () => {
    expect(
      resolveLockedRequestedWithdrawShares({
        requestedLockedAssets: 25_000000000000000000n,
        maxWithdrawAssets: 50_000000000000000000n,
        maxRedeemShares: 49_000000000000000000n,
        previewWithdrawShares: 60_000000000000000000n,
        lockedPricePerShare: 1_000000000000000000n,
        lockedVaultTokenDecimals: 18
      })
    ).toBe(49_000000000000000000n)
  })
})

describe('cooldown max selection', () => {
  it('derives the exact cooldown asset cap from the locked share balance', () => {
    expect(
      getLockedCooldownMaxAssetAmount({
        lockedWalletShares: 50_000000000000000000n,
        lockedPricePerShare: 1_000000000000000000n,
        lockedVaultTokenDecimals: 18
      })
    ).toBe(50_000000000000000000n)
  })

  it('derives the displayed cooldown max amount from the exact cooldown asset cap', () => {
    expect(
      getLockedCooldownMaxDisplayAmount({
        maxCooldownAssetAmount: 50_000000000000000000n,
        isLockedUnderlyingDisplay: true,
        unlockedPricePerShare: 1_020000n,
        unlockedVaultDecimals: 18
      })
    ).toBe(51_000000n)
  })

  it('snaps a pre-cooldown max input back to the exact cooldown asset cap', () => {
    expect(
      resolveLockedRequestedAmountFromInput({
        amount: 51_000000n,
        inputUnit: 'underlying',
        canWithdrawNow: false,
        needsCooldownStart: true,
        maxCooldownDisplayAmount: 51_000000n,
        maxCooldownAssetAmount: 50_000000000000000000n,
        previewWithdrawLockedAssets: 49_999999999999999999n,
        lockedDisplayPricePerShare: 1_020000n,
        lockedVaultTokenDecimals: 18,
        unlockedPricePerShare: 1_020000n,
        unlockedVaultDecimals: 18
      })
    ).toBe(50_000000000000000000n)
  })

  it('uses previewWithdraw for partial pre-cooldown underlying input when available', () => {
    expect(
      resolveLockedRequestedAmountFromInput({
        amount: 25_000000n,
        inputUnit: 'underlying',
        canWithdrawNow: false,
        needsCooldownStart: true,
        maxCooldownDisplayAmount: 51_000000n,
        maxCooldownAssetAmount: 50_000000000000000000n,
        previewWithdrawLockedAssets: 24_600000000000000000n,
        lockedDisplayPricePerShare: 1_020000n,
        lockedVaultTokenDecimals: 18,
        unlockedPricePerShare: 1_020000n,
        unlockedVaultDecimals: 18
      })
    ).toBe(24_600000000000000000n)
  })

  it('starts cooldown with the full share balance when the exact cooldown asset cap is selected', () => {
    expect(
      resolveCooldownSharesToStart({
        needsCooldownStart: true,
        lockedRequestedAmountRaw: 50_000000000000000000n,
        maxCooldownAssetAmount: 50_000000000000000000n,
        previewWithdrawShares: 49_999999999999999999n,
        lockedPricePerShare: 1_000000000000000000n,
        lockedVaultTokenDecimals: 18,
        lockedWalletShares: 50_000000000000000000n
      })
    ).toBe(50_000000000000000000n)
  })

  it('uses previewWithdraw shares for partial cooldown selection when available', () => {
    expect(
      resolveCooldownSharesToStart({
        needsCooldownStart: true,
        lockedRequestedAmountRaw: 24_600000000000000000n,
        maxCooldownAssetAmount: 50_000000000000000000n,
        previewWithdrawShares: 23_700000000000000000n,
        lockedPricePerShare: 1_000000000000000000n,
        lockedVaultTokenDecimals: 18,
        lockedWalletShares: 50_000000000000000000n
      })
    ).toBe(23_700000000000000000n)
  })
})

describe('resolveLockedRedeemAssets', () => {
  it('uses previewRedeem for partial locked-leg share redemptions when it is available', () => {
    expect(
      resolveLockedRedeemAssets({
        requestedLockedShares: 25_000000000000000000n,
        maxWithdrawAssets: 50_000000000000000000n,
        maxRedeemShares: 49_999999999999999999n,
        previewRedeemAssets: 24_800000000000000000n,
        lockedPricePerShare: 1_000000000000000000n,
        lockedVaultTokenDecimals: 18
      })
    ).toBe(24_800000000000000000n)
  })

  it('uses the authoritative maxWithdraw assets for an exact max redeem', () => {
    expect(
      resolveLockedRedeemAssets({
        requestedLockedShares: 49_999999999999999999n,
        maxWithdrawAssets: 50_000000000000000000n,
        maxRedeemShares: 49_999999999999999999n,
        lockedPricePerShare: 1_000000000000000000n,
        lockedVaultTokenDecimals: 18
      })
    ).toBe(50_000000000000000000n)
  })
})

describe('resolveLockedWithdrawMethod', () => {
  it('uses redeem when the redeem quote can satisfy the requested locked assets', () => {
    expect(
      resolveLockedWithdrawMethod({
        requestedLockedAssets: 50_000000000000000000n,
        requestedLockedShares: 49_999999999999999999n,
        redeemableLockedAssets: 50_000000000000000000n
      })
    ).toBe('redeem')
  })

  it('falls back to withdraw when redeemable shares or assets cannot satisfy the requested locked assets', () => {
    expect(
      resolveLockedWithdrawMethod({
        requestedLockedAssets: 1n,
        requestedLockedShares: 0n,
        redeemableLockedAssets: 0n
      })
    ).toBe('withdraw')

    expect(
      resolveLockedWithdrawMethod({
        requestedLockedAssets: 100n,
        requestedLockedShares: 9n,
        redeemableLockedAssets: 99n
      })
    ).toBe('withdraw')
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

describe('shouldNormalizeLockedWithdrawDisplayAmount', () => {
  it('normalizes a post-cooldown max selection back to the authoritative display max', () => {
    expect(
      shouldNormalizeLockedWithdrawDisplayAmount({
        canWithdrawNow: true,
        currentDisplayAmount: 500_000001n,
        maxDisplayAmount: 500_000000n,
        requestedLockedAssets: 497_396866n,
        maxWithdrawAssets: 497_396866n
      })
    ).toBe(true)
  })

  it('does not normalize partial withdraws or inactive withdraw windows', () => {
    expect(
      shouldNormalizeLockedWithdrawDisplayAmount({
        canWithdrawNow: true,
        currentDisplayAmount: 250_000000n,
        maxDisplayAmount: 500_000000n,
        requestedLockedAssets: 248_698433n,
        maxWithdrawAssets: 497_396866n
      })
    ).toBe(false)

    expect(
      shouldNormalizeLockedWithdrawDisplayAmount({
        canWithdrawNow: false,
        currentDisplayAmount: 500_000001n,
        maxDisplayAmount: 500_000000n,
        requestedLockedAssets: 497_396866n,
        maxWithdrawAssets: 497_396866n
      })
    ).toBe(false)
  })
})

describe('buildLockedWithdrawNoZapExecutionPlan', () => {
  it('builds a two-step no-zap execution plan with a locked redeem followed by an unlocked withdraw', () => {
    const plan = buildLockedWithdrawNoZapExecutionPlan({
      account: '0x1111111111111111111111111111111111111111',
      lockedStepMethod: 'redeem',
      requestedLockedAssets: 50_000000000000000000n,
      requestedLockedShares: 49_999999999999999999n,
      requestedUnderlyingAssets: 51_000000n
    })

    expect(plan).toHaveLength(2)
    expect(plan[0]?.functionName).toBe('redeem')
    expect(plan[1]?.functionName).toBe('withdraw')
    expect(plan[0]?.args[0]).toBe(49_999999999999999999n)
    expect(plan[1]?.args[0]).toBe(51_000000n)
  })

  it('does not introduce an approval step for the locked no-zap flow', () => {
    const plan = buildLockedWithdrawNoZapExecutionPlan({
      account: '0x1111111111111111111111111111111111111111',
      lockedStepMethod: 'redeem',
      requestedLockedAssets: 1n,
      requestedLockedShares: 1n,
      requestedUnderlyingAssets: 1n
    })

    expect(plan.map((step) => step.functionName)).toEqual(['redeem', 'withdraw'])
  })

  it('falls back to a locked withdraw when the redeem path cannot represent the requested assets', () => {
    const plan = buildLockedWithdrawNoZapExecutionPlan({
      account: '0x1111111111111111111111111111111111111111',
      lockedStepMethod: 'withdraw',
      requestedLockedAssets: 1n,
      requestedLockedShares: 0n,
      requestedUnderlyingAssets: 1n
    })

    expect(plan.map((step) => step.functionName)).toEqual(['withdraw', 'withdraw'])
    expect(plan[0]?.args[0]).toBe(1n)
  })
})

describe('buildLockedWithdrawTransactionStep', () => {
  it('builds wrapper-owned redeem and withdraw overlay steps', () => {
    const withdrawStep = buildLockedWithdrawTransactionStep({
      phase: 'withdraw',
      lockedStepMethod: 'redeem',
      prepareLockedWithdraw: mockPrepare('redeem', [49n, '0x1', '0x1']),
      prepareUnlockedWithdraw: mockPrepare('withdraw', [51n, '0x1', '0x1']),
      requestedLockedShares: 49_999999999999999999n,
      receivedLockedAssets: 50_000000000000000000n,
      expectedUnderlyingOut: 51_000000n,
      lockedVaultTokenDecimals: 18,
      lockedAssetDecimals: 18,
      underlyingDecimals: 6,
      lockedVaultTokenSymbol: 'yvUSD (Locked)',
      lockedAssetSymbol: 'yvUSD',
      underlyingSymbol: 'USDC'
    })
    const withdrawUnderlyingStep = buildLockedWithdrawTransactionStep({
      phase: 'redeem',
      lockedStepMethod: 'redeem',
      prepareLockedWithdraw: mockPrepare('redeem', [49n, '0x1', '0x1']),
      prepareUnlockedWithdraw: mockPrepare('withdraw', [51n, '0x1', '0x1']),
      requestedLockedShares: 49_999999999999999999n,
      receivedLockedAssets: 50_000000000000000000n,
      expectedUnderlyingOut: 51_000000n,
      lockedVaultTokenDecimals: 18,
      lockedAssetDecimals: 18,
      underlyingDecimals: 6,
      lockedVaultTokenSymbol: 'yvUSD (Locked)',
      lockedAssetSymbol: 'yvUSD',
      underlyingSymbol: 'USDC'
    })

    expect(withdrawStep.label).toBe('Withdraw to yvUSD')
    expect(withdrawUnderlyingStep.label).toBe('Withdraw to USDC')
    expect(withdrawStep.completesFlow).toBe(false)
    expect(withdrawUnderlyingStep.completesFlow).toBe(true)
    expect(withdrawStep.confirmMessage).toContain('Redeeming')
  })

  it('shows withdraw copy when the locked leg falls back to asset-based withdraw', () => {
    const withdrawStep = buildLockedWithdrawTransactionStep({
      phase: 'withdraw',
      lockedStepMethod: 'withdraw',
      prepareLockedWithdraw: mockPrepare('withdraw', [1n, '0x1', '0x1']),
      prepareUnlockedWithdraw: mockPrepare('withdraw', [1n, '0x1', '0x1']),
      requestedLockedShares: 0n,
      receivedLockedAssets: 1n,
      expectedUnderlyingOut: 1n,
      lockedVaultTokenDecimals: 18,
      lockedAssetDecimals: 18,
      underlyingDecimals: 6,
      lockedVaultTokenSymbol: 'yvUSD (Locked)',
      lockedAssetSymbol: 'yvUSD',
      underlyingSymbol: 'USDC'
    })

    expect(withdrawStep.confirmMessage).toContain('Withdrawing')
    expect(withdrawStep.successTitle).toBe('Locked withdraw successful')
  })
})
