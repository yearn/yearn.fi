import {
  convertYvUsdLockedAssetRawAmountToUnderlying,
  convertYvUsdUnderlyingRawAmountToLockedAsset
} from '@pages/vaults/utils/yvUsd'
import { formatTAmount, toAddress } from '@shared/utils'
import type { Address } from 'viem'
import type { TransactionStep } from '../shared/TransactionOverlay'

type TLockedWithdrawStepPhase = 'withdraw' | 'redeem'
export type TYvUsdAmountUnit = 'underlying' | 'shares' | 'other'
export type TLockedWithdrawMethod = 'withdraw' | 'redeem'
export type TLockedWithdrawExecutionSnapshot = {
  lockedStepMethod: TLockedWithdrawMethod
  requestedLockedAssets: bigint
  requestedLockedShares: bigint
  receivedLockedAssets: bigint
}

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

type TResolveLockedRequestedWithdrawSharesParams = {
  requestedLockedAssets: bigint
  maxWithdrawAssets: bigint
  maxRedeemShares: bigint
  previewWithdrawShares?: bigint
  lockedPricePerShare: bigint
  lockedVaultTokenDecimals: number
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

type TResolveLockedWithdrawExecutionSnapshotParams = {
  executionSnapshot: TLockedWithdrawExecutionSnapshot | null
  currentLockedWithdrawMethod: TLockedWithdrawMethod
  currentRequestedLockedAssets: bigint
  currentRequestedLockedShares: bigint
  currentReceivedLockedAssets: bigint
}

type TResolveLockedWithdrawExpectedOutParams = {
  requestedLockedAssets: bigint
  previewRedeemAssets?: bigint
  unlockedPricePerShare: bigint
  unlockedVaultDecimals: number
}

type TResolveLockedRedeemAssetsParams = {
  requestedLockedShares: bigint
  maxWithdrawAssets: bigint
  maxRedeemShares: bigint
  previewRedeemAssets?: bigint
  lockedPricePerShare: bigint
  lockedVaultTokenDecimals: number
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
  lockedStepMethod: TLockedWithdrawMethod
  prepareLockedWithdraw: TransactionStep['prepare']
  prepareUnlockedWithdraw: TransactionStep['prepare']
  requestedLockedShares: bigint
  receivedLockedAssets: bigint
  expectedUnderlyingOut: bigint
  lockedVaultTokenDecimals: number
  lockedAssetDecimals: number
  underlyingDecimals: number
  lockedVaultTokenSymbol: string
  lockedAssetSymbol: string
  underlyingSymbol: string
}

export type TLockedWithdrawNoZapExecutionStep =
  | {
      key: 'withdraw_locked'
      functionName: TLockedWithdrawMethod
      args: readonly [bigint, Address, Address]
    }
  | {
      key: 'withdraw_unlocked'
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

  if (maxDisplayAmount > 0n && requestedDisplayAmount > maxDisplayAmount) {
    return previewWithdrawShares
  }

  return previewWithdrawShares > maxWithdrawAssets ? maxWithdrawAssets : previewWithdrawShares
}

export function resolveLockedRequestedWithdrawShares({
  requestedLockedAssets,
  maxWithdrawAssets,
  maxRedeemShares,
  previewWithdrawShares,
  lockedPricePerShare,
  lockedVaultTokenDecimals
}: TResolveLockedRequestedWithdrawSharesParams): bigint {
  if (requestedLockedAssets <= 0n || maxWithdrawAssets <= 0n || maxRedeemShares <= 0n) {
    return 0n
  }

  if (requestedLockedAssets >= maxWithdrawAssets) {
    return maxRedeemShares
  }

  if (typeof previewWithdrawShares === 'bigint' && previewWithdrawShares > 0n) {
    return previewWithdrawShares > maxRedeemShares ? maxRedeemShares : previewWithdrawShares
  }

  if (lockedPricePerShare <= 0n) {
    return 0n
  }

  const numerator = requestedLockedAssets * 10n ** BigInt(lockedVaultTokenDecimals)
  const requiredShares = (numerator + lockedPricePerShare - 1n) / lockedPricePerShare
  return requiredShares > maxRedeemShares ? maxRedeemShares : requiredShares
}

export function resolveLockedWithdrawMethod({
  requestedLockedAssets,
  requestedLockedShares,
  redeemableLockedAssets
}: {
  requestedLockedAssets: bigint
  requestedLockedShares: bigint
  redeemableLockedAssets: bigint
}): TLockedWithdrawMethod {
  if (
    requestedLockedAssets > 0n &&
    (requestedLockedShares <= 0n || redeemableLockedAssets <= 0n || redeemableLockedAssets < requestedLockedAssets)
  ) {
    return 'withdraw'
  }

  return 'redeem'
}

export function resolveLockedWithdrawExecutionSnapshot({
  executionSnapshot,
  currentLockedWithdrawMethod,
  currentRequestedLockedAssets,
  currentRequestedLockedShares,
  currentReceivedLockedAssets
}: TResolveLockedWithdrawExecutionSnapshotParams): TLockedWithdrawExecutionSnapshot {
  if (executionSnapshot) {
    return executionSnapshot
  }

  return {
    lockedStepMethod: currentLockedWithdrawMethod,
    requestedLockedAssets: currentRequestedLockedAssets,
    requestedLockedShares: currentRequestedLockedShares,
    receivedLockedAssets: currentReceivedLockedAssets
  }
}

export function shouldUseLockedManagedWithdrawFlow({
  canWithdrawNow,
  selectedTokenAddress,
  selectedChainId,
  chainId,
  underlyingAssetAddress
}: {
  canWithdrawNow: boolean
  selectedTokenAddress?: Address
  selectedChainId?: number
  chainId: number
  underlyingAssetAddress: Address
}): boolean {
  if (!canWithdrawNow) {
    return true
  }

  const destinationChainId = selectedChainId ?? chainId
  const destinationAddress = toAddress(selectedTokenAddress ?? underlyingAssetAddress)
  return destinationChainId === chainId && destinationAddress === toAddress(underlyingAssetAddress)
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

export function resolveLockedRedeemAssets({
  requestedLockedShares,
  maxWithdrawAssets,
  maxRedeemShares,
  previewRedeemAssets,
  lockedPricePerShare,
  lockedVaultTokenDecimals
}: TResolveLockedRedeemAssetsParams): bigint {
  if (requestedLockedShares <= 0n || maxWithdrawAssets <= 0n || maxRedeemShares <= 0n) {
    return 0n
  }

  if (typeof previewRedeemAssets === 'bigint') {
    return previewRedeemAssets
  }

  if (requestedLockedShares >= maxRedeemShares) {
    return maxWithdrawAssets
  }

  if (lockedPricePerShare <= 0n) {
    return 0n
  }

  return (requestedLockedShares * lockedPricePerShare) / 10n ** BigInt(lockedVaultTokenDecimals)
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
  lockedStepMethod: TLockedWithdrawMethod
  requestedLockedShares: bigint
  requestedLockedAssets: bigint
  requestedUnderlyingAssets: bigint
}): TLockedWithdrawNoZapExecutionStep[] {
  const firstStepAmount =
    params.lockedStepMethod === 'redeem' ? params.requestedLockedShares : params.requestedLockedAssets
  if (!params.account || firstStepAmount <= 0n) {
    return []
  }

  const account = toAddress(params.account)
  const lockedWithdrawStep: TLockedWithdrawNoZapExecutionStep = {
    key: 'withdraw_locked',
    functionName: params.lockedStepMethod,
    args: [firstStepAmount, account, account]
  }

  if (params.requestedUnderlyingAssets <= 0n) {
    return [lockedWithdrawStep]
  }

  return [
    lockedWithdrawStep,
    {
      key: 'withdraw_unlocked',
      functionName: 'withdraw',
      args: [params.requestedUnderlyingAssets, account, account]
    }
  ]
}

export function buildLockedWithdrawTransactionStep({
  phase,
  lockedStepMethod,
  prepareLockedWithdraw,
  prepareUnlockedWithdraw,
  requestedLockedShares,
  receivedLockedAssets,
  expectedUnderlyingOut,
  lockedVaultTokenDecimals,
  lockedAssetDecimals,
  underlyingDecimals,
  lockedVaultTokenSymbol,
  lockedAssetSymbol,
  underlyingSymbol
}: TBuildLockedWithdrawStepParams): TransactionStep {
  const formattedLockedShares = formatTAmount({
    value: requestedLockedShares,
    decimals: lockedVaultTokenDecimals
  })
  const formattedLockedAssets = formatTAmount({
    value: receivedLockedAssets,
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
      confirmMessage:
        lockedStepMethod === 'redeem'
          ? `Redeeming ${formattedLockedShares} ${lockedVaultTokenSymbol} from the locked vault`
          : `Withdrawing ${formattedLockedAssets} ${lockedAssetSymbol} from the locked vault`,
      successTitle: lockedStepMethod === 'redeem' ? 'Locked redeem successful' : 'Locked withdraw successful',
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
