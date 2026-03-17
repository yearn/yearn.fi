import { convertYvUsdLockedAssetRawAmountToUnderlying } from '@pages/vaults/utils/yvUsd'
import type { AppUseSimulateContractReturnType } from '@shared/hooks/useAppWagmi'
import { formatTAmount, toAddress } from '@shared/utils'
import type { Address } from 'viem'
import type { TransactionStep } from '../shared/TransactionOverlay'

type TLockedWithdrawStepPhase = 'withdraw' | 'redeem'

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

type TResolveLockedWithdrawExpectedOutParams = {
  requestedLockedAssets: bigint
  previewRedeemAssets?: bigint
  unlockedPricePerShare: bigint
  unlockedVaultDecimals: number
}

type TBuildLockedWithdrawStepParams = {
  phase: TLockedWithdrawStepPhase
  prepareLockedWithdraw: AppUseSimulateContractReturnType
  prepareUnlockedRedeem: AppUseSimulateContractReturnType
  requestedLockedAssets: bigint
  expectedUnderlyingOut: bigint
  lockedAssetDecimals: number
  underlyingDecimals: number
  lockedAssetSymbol: string
  underlyingSymbol: string
}

export type TLockedWithdrawNoZapExecutionStep = {
  key: 'withdraw_locked' | 'redeem_unlocked'
  functionName: 'withdraw' | 'redeem'
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

export function buildLockedWithdrawNoZapExecutionPlan(params: {
  account?: Address
  requestedLockedAssets: bigint
}): TLockedWithdrawNoZapExecutionStep[] {
  if (!params.account || params.requestedLockedAssets <= 0n) {
    return []
  }

  const account = toAddress(params.account)

  return [
    {
      key: 'withdraw_locked',
      functionName: 'withdraw',
      args: [params.requestedLockedAssets, account, account]
    },
    {
      key: 'redeem_unlocked',
      functionName: 'redeem',
      args: [params.requestedLockedAssets, account, account]
    }
  ]
}

export function buildLockedWithdrawTransactionStep({
  phase,
  prepareLockedWithdraw,
  prepareUnlockedRedeem,
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
      successMessage: `Received ${formattedLockedAssets} ${lockedAssetSymbol}. Continuing to redeem for ${underlyingSymbol}.`,
      completesFlow: false
    }
  }

  return {
    prepare: prepareUnlockedRedeem,
    label: 'Redeem to USDC',
    confirmMessage: `Redeeming ${formattedLockedAssets} ${lockedAssetSymbol} for ${formattedUnderlyingOut} ${underlyingSymbol}`,
    successTitle: 'Withdraw successful!',
    successMessage: `You have withdrawn ${formattedUnderlyingOut} ${underlyingSymbol}.`,
    completesFlow: true
  }
}
