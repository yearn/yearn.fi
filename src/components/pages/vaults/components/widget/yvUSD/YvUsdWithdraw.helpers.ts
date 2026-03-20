import {
  convertYvUsdLockedAssetRawAmountToUnderlying,
  convertYvUsdUnderlyingRawAmountToLockedAsset
} from '@pages/vaults/utils/yvUsd'
import type { AppUseSimulateContractReturnType } from '@shared/hooks/useAppWagmi'
import { formatTAmount, toAddress } from '@shared/utils'
import type { Address } from 'viem'
import type { TransactionStep } from '../shared/TransactionOverlay'

type TLockedWithdrawStepPhase = 'withdraw' | 'redeem'
export type TYvUsdAmountUnit = 'underlying' | 'shares' | 'other'

type TResolveLockedWithdrawAmountParams = {
  maxWithdrawAssets: bigint
  previewRedeemAssets?: bigint
  unlockedPricePerShare: bigint
  unlockedVaultDecimals: number
}

type TResolveLockedRequestedWithdrawAssetsParams = {
  requestedDisplayAmount: bigint
  maxDisplayAmount: bigint
  maxWithdrawAssets: bigint
  previewWithdrawShares?: bigint
}

type TResolveLockedRequestedAmountFromInputParams = {
  amount: bigint
  inputUnit: TYvUsdAmountUnit
  canWithdrawNow: boolean
  needsCooldownStart: boolean
  maxCooldownDisplayAmount: bigint
  maxCooldownAssetAmount: bigint
  previewWithdrawLockedAssets?: bigint
  lockedDisplayPricePerShare: bigint
  lockedVaultTokenDecimals: number
  unlockedPricePerShare: bigint
  unlockedVaultDecimals: number
}

type TResolveLockedWithdrawExpectedOutParams = {
  requestedLockedAssets: bigint
  previewRedeemAssets?: bigint
  unlockedPricePerShare: bigint
  unlockedVaultDecimals: number
}

type TShouldNormalizeLockedWithdrawDisplayAmountParams = {
  canWithdrawNow: boolean
  currentDisplayAmount: bigint
  maxDisplayAmount: bigint
  requestedLockedAssets: bigint
  maxWithdrawAssets: bigint
}

type TResolveCooldownSharesToStartParams = {
  needsCooldownStart: boolean
  lockedRequestedAmountRaw: bigint
  maxCooldownAssetAmount: bigint
  previewWithdrawShares?: bigint
  lockedPricePerShare: bigint
  lockedVaultTokenDecimals: number
  lockedWalletShares: bigint
}

type TBuildLockedWithdrawStepParams = {
  phase: TLockedWithdrawStepPhase
  prepareLockedWithdraw: AppUseSimulateContractReturnType
  prepareUnlockedWithdraw: AppUseSimulateContractReturnType
  requestedLockedAssets: bigint
  expectedUnderlyingOut: bigint
  lockedAssetDecimals: number
  underlyingDecimals: number
  lockedAssetSymbol: string
  underlyingSymbol: string
}

export type TLockedWithdrawNoZapExecutionStep = {
  key: 'withdraw_locked' | 'withdraw_unlocked'
  functionName: 'withdraw'
  args: readonly [bigint, Address, Address]
}

export function resolveLockedWithdrawDisplayAmount({
  maxWithdrawAssets,
  previewRedeemAssets,
  unlockedPricePerShare,
  unlockedVaultDecimals
}: TResolveLockedWithdrawAmountParams): bigint {
  if (maxWithdrawAssets <= 0n) {
    return 0n
  }

  if (typeof previewRedeemAssets === 'bigint') {
    return previewRedeemAssets
  }

  return convertYvUsdLockedAssetRawAmountToUnderlying({
    amount: maxWithdrawAssets,
    unlockedPricePerShare,
    unlockedVaultDecimals
  })
}

export function resolveLockedRequestedWithdrawAssets({
  requestedDisplayAmount,
  maxDisplayAmount,
  maxWithdrawAssets,
  previewWithdrawShares
}: TResolveLockedRequestedWithdrawAssetsParams): bigint {
  if (requestedDisplayAmount <= 0n || maxWithdrawAssets <= 0n) {
    return 0n
  }

  if (maxDisplayAmount > 0n && requestedDisplayAmount >= maxDisplayAmount) {
    return maxWithdrawAssets
  }

  if (typeof previewWithdrawShares !== 'bigint' || previewWithdrawShares <= 0n) {
    return 0n
  }

  return previewWithdrawShares > maxWithdrawAssets ? maxWithdrawAssets : previewWithdrawShares
}

export function getLockedCooldownMaxAssetAmount({
  lockedWalletShares,
  lockedPricePerShare,
  lockedVaultTokenDecimals
}: {
  lockedWalletShares: bigint
  lockedPricePerShare: bigint
  lockedVaultTokenDecimals: number
}): bigint {
  if (lockedWalletShares <= 0n || lockedPricePerShare <= 0n) {
    return 0n
  }

  return (lockedWalletShares * lockedPricePerShare) / 10n ** BigInt(lockedVaultTokenDecimals)
}

export function getLockedCooldownMaxDisplayAmount({
  maxCooldownAssetAmount,
  isLockedUnderlyingDisplay,
  unlockedPricePerShare,
  unlockedVaultDecimals
}: {
  maxCooldownAssetAmount: bigint
  isLockedUnderlyingDisplay: boolean
  unlockedPricePerShare: bigint
  unlockedVaultDecimals: number
}): bigint {
  if (maxCooldownAssetAmount <= 0n) {
    return 0n
  }

  if (!isLockedUnderlyingDisplay) {
    return maxCooldownAssetAmount
  }

  return convertYvUsdLockedAssetRawAmountToUnderlying({
    amount: maxCooldownAssetAmount,
    unlockedPricePerShare,
    unlockedVaultDecimals
  })
}

export function resolveLockedRequestedAmountFromInput({
  amount,
  inputUnit,
  canWithdrawNow,
  needsCooldownStart,
  maxCooldownDisplayAmount,
  maxCooldownAssetAmount,
  previewWithdrawLockedAssets,
  lockedDisplayPricePerShare,
  lockedVaultTokenDecimals,
  unlockedPricePerShare,
  unlockedVaultDecimals
}: TResolveLockedRequestedAmountFromInputParams): bigint {
  if (!canWithdrawNow && needsCooldownStart && maxCooldownDisplayAmount > 0n && amount >= maxCooldownDisplayAmount) {
    return maxCooldownAssetAmount
  }

  if (inputUnit === 'shares') {
    return amount
  }

  if (!canWithdrawNow && typeof previewWithdrawLockedAssets === 'bigint' && previewWithdrawLockedAssets > 0n) {
    return previewWithdrawLockedAssets > maxCooldownAssetAmount ? maxCooldownAssetAmount : previewWithdrawLockedAssets
  }

  if (canWithdrawNow) {
    if (lockedDisplayPricePerShare <= 0n) {
      return 0n
    }

    return (
      (amount * 10n ** BigInt(lockedVaultTokenDecimals) + lockedDisplayPricePerShare - 1n) / lockedDisplayPricePerShare
    )
  }

  return convertYvUsdUnderlyingRawAmountToLockedAsset({
    amount,
    unlockedPricePerShare,
    unlockedVaultDecimals
  })
}

export function resolveLockedWithdrawExpectedOut({
  requestedLockedAssets,
  previewRedeemAssets,
  unlockedPricePerShare,
  unlockedVaultDecimals
}: TResolveLockedWithdrawExpectedOutParams): bigint {
  if (requestedLockedAssets <= 0n) {
    return 0n
  }

  if (typeof previewRedeemAssets === 'bigint') {
    return previewRedeemAssets
  }

  return convertYvUsdLockedAssetRawAmountToUnderlying({
    amount: requestedLockedAssets,
    unlockedPricePerShare,
    unlockedVaultDecimals
  })
}

export function shouldNormalizeLockedWithdrawDisplayAmount({
  canWithdrawNow,
  currentDisplayAmount,
  maxDisplayAmount,
  requestedLockedAssets,
  maxWithdrawAssets
}: TShouldNormalizeLockedWithdrawDisplayAmountParams): boolean {
  return (
    canWithdrawNow &&
    currentDisplayAmount > 0n &&
    maxDisplayAmount > 0n &&
    maxWithdrawAssets > 0n &&
    requestedLockedAssets === maxWithdrawAssets &&
    currentDisplayAmount !== maxDisplayAmount
  )
}

export function resolveCooldownSharesToStart({
  needsCooldownStart,
  lockedRequestedAmountRaw,
  maxCooldownAssetAmount,
  previewWithdrawShares,
  lockedPricePerShare,
  lockedVaultTokenDecimals,
  lockedWalletShares
}: TResolveCooldownSharesToStartParams): bigint {
  if (!needsCooldownStart || lockedRequestedAmountRaw <= 0n) {
    return 0n
  }

  if (maxCooldownAssetAmount > 0n && lockedRequestedAmountRaw >= maxCooldownAssetAmount) {
    return lockedWalletShares
  }

  if (typeof previewWithdrawShares === 'bigint' && previewWithdrawShares > 0n) {
    return previewWithdrawShares > lockedWalletShares ? lockedWalletShares : previewWithdrawShares
  }

  if (lockedPricePerShare <= 0n) {
    return 0n
  }

  const numerator = lockedRequestedAmountRaw * 10n ** BigInt(lockedVaultTokenDecimals)
  const requiredShares = (numerator + lockedPricePerShare - 1n) / lockedPricePerShare
  return requiredShares > lockedWalletShares ? lockedWalletShares : requiredShares
}

export function buildLockedWithdrawNoZapExecutionPlan(params: {
  account?: Address
  requestedLockedAssets: bigint
  requestedUnderlyingAssets: bigint
}): TLockedWithdrawNoZapExecutionStep[] {
  if (!params.account || params.requestedLockedAssets <= 0n) {
    return []
  }

  const account = toAddress(params.account)

  const plan: TLockedWithdrawNoZapExecutionStep[] = [
    {
      key: 'withdraw_locked',
      functionName: 'withdraw',
      args: [params.requestedLockedAssets, account, account]
    }
  ]

  if (params.requestedUnderlyingAssets > 0n) {
    plan.push({
      key: 'withdraw_unlocked',
      functionName: 'withdraw',
      args: [params.requestedUnderlyingAssets, account, account]
    })
  }

  return plan
}

export function buildLockedWithdrawTransactionStep({
  phase,
  prepareLockedWithdraw,
  prepareUnlockedWithdraw,
  requestedLockedAssets,
  expectedUnderlyingOut,
  lockedAssetDecimals,
  underlyingDecimals,
  lockedAssetSymbol,
  underlyingSymbol
}: TBuildLockedWithdrawStepParams): TransactionStep {
  const formattedLockedAssets = formatTAmount({
    value: requestedLockedAssets,
    decimals: lockedAssetDecimals
  })
  const formattedUnderlyingOut = formatTAmount({
    value: expectedUnderlyingOut,
    decimals: underlyingDecimals
  })

  if (phase === 'withdraw') {
    return {
      prepare: prepareLockedWithdraw,
      label: 'Withdraw to yvUSD',
      confirmMessage: `Withdrawing ${formattedLockedAssets} ${lockedAssetSymbol} from the locked vault`,
      successTitle: 'Locked withdraw successful',
      successMessage: `Received ${formattedLockedAssets} ${lockedAssetSymbol}. Continuing to withdraw ${formattedUnderlyingOut} ${underlyingSymbol}.`,
      completesFlow: false
    }
  }

  return {
    prepare: prepareUnlockedWithdraw,
    label: 'Withdraw to USDC',
    confirmMessage: `Withdrawing ${formattedUnderlyingOut} ${underlyingSymbol} from unlocked yvUSD`,
    successTitle: 'Withdraw successful!',
    successMessage: `You have withdrawn ${formattedUnderlyingOut} ${underlyingSymbol}.`,
    completesFlow: true
  }
}
