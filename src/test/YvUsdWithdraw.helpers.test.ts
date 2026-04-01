import {
  getLockedCooldownMaxAssetAmount,
  getLockedCooldownMaxDisplayAmount,
  resolveCooldownSharesToStart,
  resolveLockedRedeemAssets,
  resolveLockedRequestedAmountFromInput,
  resolveLockedRequestedWithdrawAssets,
  resolveLockedRequestedWithdrawShares,
  resolveLockedWithdrawDisplayAmount
} from '@pages/vaults/components/widget/yvUSD/YvUsdWithdraw.helpers'
import { describe, expect, it } from 'vitest'

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

  it('keeps over-limit withdraw inputs above the cap so the widget can show an error instead of snapping to max', () => {
    expect(
      resolveLockedRequestedWithdrawAssets({
        requestedDisplayAmount: 52_000000n,
        maxDisplayAmount: 51_000000n,
        maxWithdrawAssets: 50_000000000000000000n,
        previewWithdrawShares: 51_500000000000000000n
      })
    ).toBe(51_500000000000000000n)
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
