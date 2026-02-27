import type { TCreateNotificationParams } from '@shared/types/notifications'
import type { TransactionStep } from '../shared/TransactionOverlay'
import type { WithdrawRouteType } from './types'

type TBuildWithdrawTransactionStepArgs = {
  needsApproval: boolean
  approvePrepare?: TransactionStep['prepare']
  activeWithdrawPrepare?: TransactionStep['prepare']
  directUnstakePrepare?: TransactionStep['prepare']
  directWithdrawPrepare?: TransactionStep['prepare']
  fallbackStep: 'unstake' | 'withdraw'
  routeType: WithdrawRouteType
  isCrossChain: boolean
  formattedApprovalAmount: string
  approvalTokenSymbol?: string
  formattedRequiredShares: string
  formattedWithdrawAmount: string
  assetTokenSymbol?: string
  vaultSymbol?: string
  stakingTokenSymbol?: string
  approveNotificationParams?: TCreateNotificationParams
  unstakeNotificationParams?: TCreateNotificationParams
  withdrawNotificationParams?: TCreateNotificationParams
}

type TWithdrawCtaStateArgs = {
  hasError: boolean
  withdrawAmountRaw: bigint
  isFetchingQuote: boolean
  isDebouncing: boolean
  showApprove: boolean
  isAllowanceSufficient: boolean
  prepareApproveEnabled: boolean
  prepareWithdrawEnabled: boolean
}

export function getWithdrawTransactionName(routeType: WithdrawRouteType, isFetchingQuote: boolean): string {
  if (routeType === 'DIRECT_WITHDRAW') {
    return 'Withdraw'
  }
  if (routeType === 'DIRECT_UNSTAKE') {
    return 'Unstake'
  }
  if (routeType === 'DIRECT_UNSTAKE_WITHDRAW') {
    return 'Unstake & Withdraw'
  }
  return isFetchingQuote ? 'Fetching quote' : 'Withdraw'
}

export function buildWithdrawTransactionStep({
  needsApproval,
  approvePrepare,
  activeWithdrawPrepare,
  directUnstakePrepare,
  directWithdrawPrepare,
  fallbackStep,
  routeType,
  isCrossChain,
  formattedApprovalAmount,
  approvalTokenSymbol,
  formattedRequiredShares,
  formattedWithdrawAmount,
  assetTokenSymbol,
  vaultSymbol,
  stakingTokenSymbol,
  approveNotificationParams,
  unstakeNotificationParams,
  withdrawNotificationParams
}: TBuildWithdrawTransactionStepArgs): TransactionStep | undefined {
  if (needsApproval && approvePrepare) {
    return {
      prepare: approvePrepare,
      label: 'Approve',
      confirmMessage: `Approving ${formattedApprovalAmount} ${approvalTokenSymbol || ''}`,
      successTitle: 'Approval successful',
      successMessage: `Approved ${formattedApprovalAmount} ${approvalTokenSymbol || ''}.\nReady to withdraw.`,
      notification: approveNotificationParams
    }
  }

  if (routeType === 'DIRECT_UNSTAKE_WITHDRAW') {
    const unstakeSymbol = stakingTokenSymbol || vaultSymbol || 'shares'

    if (fallbackStep === 'unstake' && directUnstakePrepare) {
      return {
        prepare: directUnstakePrepare,
        label: 'Unstake',
        confirmMessage: `Unstaking ${formattedRequiredShares} ${unstakeSymbol}`,
        successTitle: 'Unstake successful!',
        successMessage: `You have unstaked ${formattedRequiredShares} ${unstakeSymbol}.\nPreparing your withdraw.`,
        notification: unstakeNotificationParams
      }
    }

    if (!directWithdrawPrepare) {
      return undefined
    }

    return {
      prepare: directWithdrawPrepare,
      label: 'Withdraw',
      confirmMessage: `Withdrawing ${formattedWithdrawAmount} ${assetTokenSymbol || ''}`,
      successTitle: 'Withdraw successful!',
      successMessage: `You have withdrawn ${formattedWithdrawAmount} ${assetTokenSymbol || ''}.`,
      notification: withdrawNotificationParams
    }
  }

  if (!activeWithdrawPrepare) {
    return undefined
  }

  const withdrawLabel = routeType === 'DIRECT_UNSTAKE' ? 'Unstake' : 'Withdraw'
  const actionVerb = routeType === 'DIRECT_UNSTAKE' ? 'Unstaking' : 'Withdrawing'

  if (isCrossChain) {
    return {
      prepare: activeWithdrawPrepare,
      label: withdrawLabel,
      confirmMessage: `${actionVerb} ${formattedWithdrawAmount} ${assetTokenSymbol || ''}`,
      successTitle: 'Transaction Submitted',
      successMessage: `Your cross-chain ${withdrawLabel.toLowerCase()} has been submitted.\nIt may take a few minutes to complete on the destination chain.`,
      notification: withdrawNotificationParams
    }
  }

  const successAction = routeType === 'DIRECT_UNSTAKE' ? 'unstaked' : 'withdrawn'
  return {
    prepare: activeWithdrawPrepare,
    label: withdrawLabel,
    confirmMessage: `${actionVerb} ${formattedWithdrawAmount} ${assetTokenSymbol || ''}`,
    successTitle: `${withdrawLabel} successful!`,
    successMessage: `You have ${successAction} ${formattedWithdrawAmount} ${assetTokenSymbol || ''}.`,
    notification: withdrawNotificationParams
  }
}

export function isWithdrawLastStep({
  currentStep,
  needsApproval,
  routeType
}: {
  currentStep?: TransactionStep
  needsApproval: boolean
  routeType: WithdrawRouteType
}): boolean {
  if (!currentStep) return true
  if (needsApproval) return false
  if (routeType === 'DIRECT_UNSTAKE_WITHDRAW') {
    return currentStep.label === 'Withdraw'
  }
  return true
}

export function isWithdrawCtaDisabled({
  hasError,
  withdrawAmountRaw,
  isFetchingQuote,
  isDebouncing,
  showApprove,
  isAllowanceSufficient,
  prepareApproveEnabled,
  prepareWithdrawEnabled
}: TWithdrawCtaStateArgs): boolean {
  if (hasError || withdrawAmountRaw === 0n || isFetchingQuote || isDebouncing) {
    return true
  }

  if (showApprove && !isAllowanceSufficient && !prepareApproveEnabled) {
    return true
  }

  if ((!showApprove || isAllowanceSufficient) && !prepareWithdrawEnabled) {
    return true
  }

  return false
}

export function getWithdrawCtaLabel({
  isFetchingQuote,
  showApprove,
  isAllowanceSufficient,
  transactionName
}: {
  isFetchingQuote: boolean
  showApprove: boolean
  isAllowanceSufficient: boolean
  transactionName: string
}): string {
  if (isFetchingQuote) {
    return 'Fetching quote'
  }
  if (showApprove && !isAllowanceSufficient) {
    return `Approve & ${transactionName}`
  }
  return transactionName
}
