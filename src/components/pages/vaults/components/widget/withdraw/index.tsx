import { usePlausible } from '@hooks/usePlausible'
import { useDebouncedInput } from '@pages/vaults/hooks/useDebouncedInput'
import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { Button } from '@shared/components/Button'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCross } from '@shared/icons/IconCross'
import { IconSettings } from '@shared/icons/IconSettings'
import type { TNormalizedBN } from '@shared/types'
import { cl, formatTAmount, toAddress, toNormalizedBN, zeroNormalizedBN } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'
import { SettingsPanel } from '../SettingsPanel'
import { TokenSelectorOverlay } from '../shared/TokenSelectorOverlay'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { useResetEnsoSelection } from '../shared/useResetEnsoSelection'
import { formatWidgetValue } from '../shared/valueDisplay'
import { WidgetHeader } from '../shared/WidgetHeader'
import { getPriorityTokens } from './constants'
import { SourceSelector } from './SourceSelector'
import type { WithdrawalSource, WithdrawRouteType, WithdrawWidgetProps } from './types'
import { useWithdrawError } from './useWithdrawError'
import { useWithdrawFlow } from './useWithdrawFlow'
import { useWithdrawNotifications } from './useWithdrawNotifications'
import { WithdrawDetails } from './WithdrawDetails'
import { WithdrawDetailsOverlay } from './WithdrawDetailsOverlay'

type WidgetWithdrawProps = WithdrawWidgetProps & {
  hideSettings?: boolean
  disableBorderRadius?: boolean
  collapseDetails?: boolean
  contentBelowInput?: ReactNode
  hideContainerBorder?: boolean
  onTokenSelectionChange?: (address: `0x${string}`, chainId: number) => void
}

type WithdrawActionCopy = {
  actionLabel: string
  progressLabel: string
  pastTenseLabel: string
}

function resolveWithdrawalSource(hasVaultBalance: boolean, hasStakingBalance: boolean): WithdrawalSource | undefined {
  if (hasVaultBalance && !hasStakingBalance) {
    return 'vault'
  }
  if (!hasVaultBalance && hasStakingBalance) {
    return 'staking'
  }
  return undefined
}

function getWithdrawBalance(
  withdrawalSource: WithdrawalSource,
  vault: WithdrawWidgetProps['vaultUserData']['vaultToken'],
  stakingToken: WithdrawWidgetProps['vaultUserData']['stakingToken']
): TNormalizedBN {
  if (withdrawalSource === 'vault' && vault) {
    return vault.balance
  }
  if (withdrawalSource === 'staking' && stakingToken) {
    return stakingToken.balance
  }
  return zeroNormalizedBN
}

function getSourceTokenAddress(
  withdrawalSource: WithdrawalSource,
  vaultAddress: `0x${string}`,
  stakingAddress?: `0x${string}`
): `0x${string}` {
  if (withdrawalSource === 'staking' && stakingAddress) {
    return stakingAddress
  }
  return vaultAddress
}

function getWithdrawActionCopy(routeType: WithdrawRouteType): WithdrawActionCopy {
  if (routeType === 'DIRECT_UNSTAKE') {
    return {
      actionLabel: 'Unstake',
      progressLabel: 'Unstaking',
      pastTenseLabel: 'unstaked'
    }
  }

  return {
    actionLabel: 'Withdraw',
    progressLabel: 'Withdrawing',
    pastTenseLabel: 'withdrawn'
  }
}

function getWithdrawActionLabel(isUnstake: boolean, withdrawalSource: WithdrawalSource): string {
  if (isUnstake) {
    return 'You will unstake'
  }
  if (withdrawalSource === 'staking') {
    return 'You will unstake and redeem'
  }
  return 'You will redeem'
}

function getTransactionName(routeType: WithdrawRouteType, isLoadingRoute: boolean): string {
  if (routeType === 'DIRECT_WITHDRAW') {
    return 'Withdraw'
  }
  if (routeType === 'DIRECT_UNSTAKE') {
    return 'Unstake'
  }
  if (isLoadingRoute) {
    return 'Fetching quote'
  }
  return 'Withdraw'
}

function getWithdrawButtonLabel(isLoadingRoute: boolean, needsApproval: boolean, transactionName: string): string {
  if (isLoadingRoute) {
    return 'Fetching quote'
  }
  if (needsApproval) {
    return `Approve & ${transactionName}`
  }
  return transactionName
}

function getZapNotificationText(isUnstake: boolean, shouldShowZapUi: boolean): string | undefined {
  if (isUnstake) {
    return 'This transaction will unstake'
  }
  if (shouldShowZapUi) {
    return '⚡ This transaction will use Enso to Zap to:'
  }
  return undefined
}

export function WidgetWithdraw({
  vaultAddress,
  assetAddress,
  displayAssetAddress,
  stakingAddress,
  chainId,
  vaultSymbol,
  vaultVersion,
  vaultUserData,
  maxWithdrawAssets,
  isActionDisabled = false,
  actionDisabledReason,
  disableTokenSelector = false,
  hideZapForTokens,
  disableAmountInput = false,
  hideActionButton = false,
  prefill,
  prefillRequestKey,
  onPrefillApplied,
  headerActions,
  onAmountChange,
  onTokenSelectionChange,
  handleWithdrawSuccess: onWithdrawSuccess,
  onOpenSettings,
  isSettingsOpen,
  disableBorderRadius,
  collapseDetails,
  contentBelowInput,
  hideContainerBorder = false
}: WidgetWithdrawProps): ReactElement {
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const { zapSlippage, getPrice } = useYearn()
  const trackEvent = usePlausible()
  const ensoEnabled = useEnsoEnabled({ chainId, vaultAddress })
  const resolvedDisplayAssetAddress = displayAssetAddress ?? assetAddress

  const [selectedToken, setSelectedToken] = useState<`0x${string}` | undefined>(
    prefill?.address ?? resolvedDisplayAssetAddress
  )
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(prefill?.chainId)
  const [showWithdrawDetailsModal, setShowWithdrawDetailsModal] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [withdrawalSource, setWithdrawalSource] = useState<WithdrawalSource>(stakingAddress ? null : 'vault')
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)
  const [hasAcceptedPriceImpact, setHasAcceptedPriceImpact] = useState(false)
  const appliedPrefillRef = useRef<string | null>(null)

  const {
    assetToken,
    vaultToken: vault,
    stakingToken,
    pricePerShare,
    isLoading: isLoadingVaultData,
    refetch: refetchVaultUserData
  } = vaultUserData

  const priorityTokens = getPriorityTokens(chainId, vaultAddress, stakingAddress)

  // Derived token values
  const withdrawToken = selectedToken || resolvedDisplayAssetAddress
  const destinationChainId = selectedChainId || chainId

  const outputToken = useMemo(() => {
    if (destinationChainId === chainId && withdrawToken === resolvedDisplayAssetAddress) {
      return assetToken
    }
    return getToken({ address: withdrawToken, chainID: destinationChainId })
  }, [getToken, withdrawToken, destinationChainId, chainId, resolvedDisplayAssetAddress, assetToken])

  const hideZapTokenSet = useMemo(
    () => new Set((hideZapForTokens || []).map((address) => toAddress(address))),
    [hideZapForTokens]
  )

  const isBaseWithdrawToken = useMemo(() => {
    const normalizedWithdrawToken = toAddress(withdrawToken)
    return (
      normalizedWithdrawToken === toAddress(resolvedDisplayAssetAddress) || hideZapTokenSet.has(normalizedWithdrawToken)
    )
  }, [withdrawToken, resolvedDisplayAssetAddress, hideZapTokenSet])

  const hasVaultBalance = (vault?.balance.raw ?? 0n) > 0n
  const hasStakingBalance = (stakingToken?.balance.raw ?? 0n) > 0n
  const hasBothBalances = hasVaultBalance && hasStakingBalance
  const singleSource = resolveWithdrawalSource(hasVaultBalance, hasStakingBalance)

  useEffect(() => {
    if (singleSource) {
      setWithdrawalSource(singleSource)
    }
  }, [singleSource])

  useEffect(() => {
    if (!collapseDetails && isDetailsPanelOpen) {
      setIsDetailsPanelOpen(false)
    }
  }, [collapseDetails, isDetailsPanelOpen])

  useResetEnsoSelection({
    ensoEnabled,
    selectedToken,
    selectedChainId,
    assetAddress: resolvedDisplayAssetAddress,
    chainId,
    showTokenSelector,
    setSelectedToken,
    setSelectedChainId,
    setShowTokenSelector
  })

  const totalVaultBalance = getWithdrawBalance(withdrawalSource, vault, stakingToken)
  const sourceToken = getSourceTokenAddress(withdrawalSource, vaultAddress, stakingAddress)

  const isUnstake = withdrawalSource === 'staking' && toAddress(withdrawToken) === toAddress(vaultAddress)
  const sharesDecimals =
    withdrawalSource === 'staking' ? (stakingToken?.decimals ?? vault?.decimals ?? 18) : (vault?.decimals ?? 18)
  const vaultDecimals = vault?.decimals ?? 18

  const totalBalanceInUnderlying: TNormalizedBN = useMemo(() => {
    if (pricePerShare === 0n || totalVaultBalance.raw === 0n || !assetToken) {
      return zeroNormalizedBN
    }
    const underlyingAmount = (totalVaultBalance.raw * pricePerShare) / 10n ** BigInt(vaultDecimals)
    return toNormalizedBN(underlyingAmount, assetToken.decimals ?? 18)
  }, [totalVaultBalance.raw, pricePerShare, vaultDecimals, assetToken])

  const withdrawInput = useDebouncedInput(assetToken?.decimals ?? 18)
  const [withdrawAmount, , setWithdrawInput] = withdrawInput

  useEffect(() => {
    if (!prefill) return
    const key = `${prefillRequestKey ?? ''}-${prefill.address}-${prefill.chainId}-${prefill.amount}`
    if (appliedPrefillRef.current === key) return
    appliedPrefillRef.current = key
    setSelectedToken(prefill.address)
    setSelectedChainId(prefill.chainId)
    if (prefill.amount !== undefined) {
      setWithdrawInput(prefill.amount)
    }
    onPrefillApplied?.()
  }, [prefill, prefillRequestKey, setWithdrawInput, onPrefillApplied])

  useEffect(() => {
    onAmountChange?.(withdrawAmount.bn)
  }, [withdrawAmount.bn, onAmountChange])

  useEffect(() => {
    onTokenSelectionChange?.(withdrawToken, destinationChainId)
  }, [destinationChainId, onTokenSelectionChange, withdrawToken])

  const usesErc4626 = Boolean(vaultVersion?.startsWith('3') || vaultVersion?.startsWith('~3'))
  const effectiveMaxWithdrawAssets = useMemo(
    () =>
      maxWithdrawAssets !== undefined && maxWithdrawAssets < totalBalanceInUnderlying.raw
        ? maxWithdrawAssets
        : totalBalanceInUnderlying.raw,
    [maxWithdrawAssets, totalBalanceInUnderlying.raw]
  )

  const isMaxWithdraw = useMemo(() => {
    return (
      withdrawAmount.bn > 0n &&
      totalBalanceInUnderlying.raw > 0n &&
      withdrawAmount.bn === effectiveMaxWithdrawAssets &&
      effectiveMaxWithdrawAssets === totalBalanceInUnderlying.raw
    )
  }, [withdrawAmount.bn, effectiveMaxWithdrawAssets, totalBalanceInUnderlying.raw])

  // ============================================================================
  // Required Shares Calculation
  // ============================================================================
  const requiredShares = useMemo(() => {
    if (!withdrawAmount.bn || withdrawAmount.bn === 0n) return 0n
    if (isMaxWithdraw && totalVaultBalance.raw > 0n) return totalVaultBalance.raw

    if (pricePerShare > 0n) {
      const numerator = withdrawAmount.bn * 10n ** BigInt(vaultDecimals)
      return (numerator + pricePerShare - 1n) / pricePerShare
    }

    return 0n
  }, [withdrawAmount.bn, isMaxWithdraw, totalVaultBalance.raw, pricePerShare, vaultDecimals])

  const { routeType, activeFlow } = useWithdrawFlow({
    withdrawToken,
    assetAddress,
    vaultAddress,
    sourceToken,
    stakingAddress,
    amount: withdrawAmount.debouncedBn,
    currentAmount: withdrawAmount.bn,
    requiredShares,
    maxShares: totalVaultBalance.raw,
    isMaxWithdraw,
    account,
    chainId,
    destinationChainId,
    outputChainId: outputToken?.chainID ?? chainId,
    assetDecimals: assetToken?.decimals ?? 18,
    vaultDecimals: vault?.decimals ?? 18,
    outputDecimals: outputToken?.decimals ?? 18,
    pricePerShare,
    slippage: zapSlippage,
    withdrawalSource,
    isUnstake,
    isDebouncing: withdrawAmount.isDebouncing,
    useErc4626: usesErc4626
  })

  const isCrossChain = destinationChainId !== chainId
  const { approveNotificationParams, withdrawNotificationParams } = useWithdrawNotifications({
    vault,
    outputToken,
    stakingToken,
    sourceToken,
    assetAddress,
    withdrawToken,
    account,
    chainId,
    destinationChainId,
    withdrawAmount: withdrawAmount.debouncedBn,
    requiredShares,
    expectedOut: activeFlow.periphery.expectedOut,
    routeType,
    routerAddress: activeFlow.periphery.routerAddress,
    isCrossChain,
    withdrawalSource: withdrawalSource || 'vault'
  })

  const withdrawError = useWithdrawError({
    amount: withdrawAmount.bn,
    debouncedAmount: withdrawAmount.debouncedBn,
    isDebouncing: withdrawAmount.isDebouncing,
    requiredShares,
    totalBalance: totalVaultBalance.raw,
    account,
    isLoadingRoute: activeFlow.periphery.isLoadingRoute,
    flowError: activeFlow.periphery.error,
    routeType,
    hasBothBalances: !!hasBothBalances,
    withdrawalSource
  })
  const exceedsExternalWithdrawLimit = maxWithdrawAssets !== undefined && withdrawAmount.bn > effectiveMaxWithdrawAssets
  const effectiveWithdrawError =
    actionDisabledReason ||
    (exceedsExternalWithdrawLimit ? 'Amount exceeds currently available withdraw limit.' : undefined) ||
    withdrawError

  const actionLabel = getWithdrawActionLabel(isUnstake, withdrawalSource)
  const transactionName = getTransactionName(routeType, activeFlow.periphery.isLoadingRoute)

  const showApprove = !!activeFlow.actions.prepareApprove && !activeFlow.periphery.isAllowanceSufficient

  const assetTokenPrice =
    assetToken?.address && assetToken?.chainID
      ? getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
      : 0

  const outputTokenPrice =
    outputToken?.address && outputToken?.chainID
      ? getPrice({ address: toAddress(outputToken.address), chainID: outputToken.chainID }).normalized
      : 0

  // Calculate price impact for high slippage warning
  const priceImpactInfo = useMemo(() => {
    const withdrawUsdValue = Number(formatUnits(withdrawAmount.bn, assetToken?.decimals ?? 18)) * assetTokenPrice
    const expectedOutUsdValue =
      Number(formatUnits(activeFlow.periphery.expectedOut, outputToken?.decimals ?? 18)) * outputTokenPrice
    const impact =
      withdrawUsdValue > 0 && expectedOutUsdValue > 0
        ? ((withdrawUsdValue - expectedOutUsdValue) / withdrawUsdValue) * 100
        : 0
    return {
      percentage: impact,
      isHigh: impact > 5
    }
  }, [
    withdrawAmount.bn,
    assetToken?.decimals,
    assetTokenPrice,
    activeFlow.periphery.expectedOut,
    outputToken?.decimals,
    outputTokenPrice
  ])

  const priceImpactAcceptanceKey = useMemo(() => {
    return [
      withdrawAmount.bn.toString(),
      requiredShares.toString(),
      routeType,
      withdrawalSource ?? '',
      sourceToken,
      withdrawToken,
      destinationChainId,
      activeFlow.periphery.routerAddress ?? '',
      activeFlow.periphery.expectedOut.toString()
    ].join(':')
  }, [
    withdrawAmount.bn,
    requiredShares,
    routeType,
    withdrawalSource,
    sourceToken,
    withdrawToken,
    destinationChainId,
    activeFlow.periphery.routerAddress,
    activeFlow.periphery.expectedOut
  ])

  useEffect(() => {
    setHasAcceptedPriceImpact(false)
  }, [priceImpactAcceptanceKey])

  const canOpenTokenSelector = ensoEnabled && !disableTokenSelector
  const shouldShowZapUi = !isBaseWithdrawToken
  const canShowAssetTokenSelector = canOpenTokenSelector && !shouldShowZapUi

  const zapToken = useMemo(() => {
    if (!shouldShowZapUi) return undefined

    const getExpectedAmount = () => {
      if (isUnstake) {
        return requiredShares > 0n ? formatWidgetValue(requiredShares, vault?.decimals ?? 18) : '0'
      }
      return activeFlow.periphery.expectedOut && activeFlow.periphery.expectedOut > 0n
        ? formatWidgetValue(activeFlow.periphery.expectedOut, outputToken?.decimals ?? 18)
        : '0'
    }

    return {
      symbol: outputToken?.symbol || 'Select Token',
      address: outputToken?.address || '',
      chainId: outputToken?.chainID || chainId,
      expectedAmount: getExpectedAmount(),
      isLoading: isUnstake ? false : activeFlow.periphery.isLoadingRoute
    }
  }, [
    shouldShowZapUi,
    isUnstake,
    requiredShares,
    vault?.decimals,
    activeFlow.periphery.expectedOut,
    activeFlow.periphery.isLoadingRoute,
    outputToken?.symbol,
    outputToken?.address,
    outputToken?.chainID,
    outputToken?.decimals,
    chainId
  ])

  const formattedWithdrawAmount = formatTAmount({ value: withdrawAmount.bn, decimals: assetToken?.decimals ?? 18 })
  const needsApproval = showApprove

  const approvalToken = withdrawalSource === 'staking' ? stakingToken : vault
  const formattedApprovalAmount = formatTAmount({ value: requiredShares, decimals: approvalToken?.decimals ?? 18 })

  const currentStep: TransactionStep | undefined = useMemo(() => {
    if (needsApproval && activeFlow.actions.prepareApprove) {
      return {
        prepare: activeFlow.actions.prepareApprove,
        label: 'Approve',
        confirmMessage: `Approving ${formattedApprovalAmount} ${approvalToken?.symbol || ''}`,
        successTitle: 'Approval successful',
        successMessage: `Approved ${formattedApprovalAmount} ${approvalToken?.symbol || ''}.\nReady to withdraw.`,
        notification: approveNotificationParams
      }
    }

    const { actionLabel, progressLabel, pastTenseLabel } = getWithdrawActionCopy(routeType)

    if (isCrossChain) {
      return {
        prepare: activeFlow.actions.prepareWithdraw,
        label: actionLabel,
        confirmMessage: `${progressLabel} ${formattedWithdrawAmount} ${assetToken?.symbol || ''}`,
        successTitle: 'Transaction Submitted',
        successMessage: `Your cross-chain ${actionLabel.toLowerCase()} has been submitted.\nIt may take a few minutes to complete on the destination chain.`,
        notification: withdrawNotificationParams
      }
    }

    return {
      prepare: activeFlow.actions.prepareWithdraw,
      label: actionLabel,
      confirmMessage: `${progressLabel} ${formattedWithdrawAmount} ${assetToken?.symbol || ''}`,
      successTitle: `${actionLabel} successful!`,
      successMessage: `You have ${pastTenseLabel} ${formattedWithdrawAmount} ${assetToken?.symbol || ''}.`,
      notification: withdrawNotificationParams
    }
  }, [
    needsApproval,
    activeFlow.actions.prepareApprove,
    activeFlow.actions.prepareWithdraw,
    formattedWithdrawAmount,
    formattedApprovalAmount,
    assetToken?.symbol,
    approvalToken?.symbol,
    routeType,
    approveNotificationParams,
    withdrawNotificationParams,
    isCrossChain
  ])

  const handleWithdrawSuccess = useCallback(() => {
    const sharesToWithdraw = formatUnits(withdrawAmount.bn, assetToken?.decimals ?? 18)
    const priceUsd = assetTokenPrice
    const valueUsd = Number(sharesToWithdraw) * assetTokenPrice

    trackEvent(PLAUSIBLE_EVENTS.WITHDRAW, {
      props: {
        chainID: String(chainId),
        vaultAddress,
        vaultSymbol,
        sharesToWithdraw,
        tokenAddress: toAddress(withdrawToken),
        tokenSymbol: outputToken?.symbol || '',
        priceUsd: String(priceUsd),
        valueUsd: String(valueUsd),
        isZap: String(routeType === 'ENSO'),
        action: 'withdraw'
      }
    })

    setWithdrawInput('')
    const tokensToRefresh = [
      { address: withdrawToken, chainID: destinationChainId },
      { address: vaultAddress, chainID: chainId }
    ]
    if (stakingAddress) {
      tokensToRefresh.push({ address: stakingAddress, chainID: chainId })
    }

    refreshWalletBalances(tokensToRefresh)
    refetchVaultUserData()
    onWithdrawSuccess?.()
  }, [
    withdrawAmount.bn,
    assetToken?.decimals,
    outputToken?.symbol,
    assetTokenPrice,
    trackEvent,
    chainId,
    vaultAddress,
    vaultSymbol,
    withdrawToken,
    routeType,
    setWithdrawInput,
    destinationChainId,
    stakingAddress,
    refreshWalletBalances,
    onWithdrawSuccess,
    refetchVaultUserData
  ])

  if (isLoadingVaultData) {
    return (
      <div className={cl('flex flex-col border border-border relative h-full', { 'rounded-lg': !disableBorderRadius })}>
        <WidgetHeader title="Withdraw" actions={headerActions} />
        <div className="flex items-center justify-center flex-1 p-6">
          <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // ============================================================================
  // Render
  // ============================================================================
  const isSettingsVisible = !!account && !!isSettingsOpen
  const onAllowanceClick =
    needsApproval && activeFlow.periphery.allowance > 0n && pricePerShare > 0n
      ? (): void => {
          const underlyingAmount =
            (activeFlow.periphery.allowance * pricePerShare) / 10n ** BigInt(vault?.decimals ?? 18)
          setWithdrawInput(formatUnits(underlyingAmount, assetToken?.decimals ?? 18))
        }
      : undefined
  const withdrawButtonLabel = getWithdrawButtonLabel(
    activeFlow.periphery.isLoadingRoute,
    needsApproval,
    transactionName
  )
  const isWithdrawButtonDisabled =
    !!effectiveWithdrawError ||
    withdrawAmount.bn === 0n ||
    !currentStep?.prepare?.isSuccess ||
    activeFlow.periphery.isLoadingRoute ||
    isActionDisabled ||
    withdrawAmount.isDebouncing ||
    (needsApproval && !activeFlow.periphery.prepareApproveEnabled) ||
    (!needsApproval && !activeFlow.periphery.prepareWithdrawEnabled)
  const showSettingsButton = !!account && !!onOpenSettings
  const zapNotificationText = getZapNotificationText(isUnstake, shouldShowZapUi)
  const onRemoveZap = canOpenTokenSelector
    ? (): void => {
        setSelectedToken(resolvedDisplayAssetAddress)
        setSelectedChainId(chainId)
      }
    : undefined

  const detailsSection = (
    <WithdrawDetails
      actionLabel={actionLabel}
      requiredShares={requiredShares}
      sharesDecimals={sharesDecimals}
      isLoadingQuote={activeFlow.periphery.isLoadingRoute}
      isQuoteStale={withdrawAmount.isDebouncing || withdrawAmount.bn !== withdrawAmount.debouncedBn}
      expectedOut={activeFlow.periphery.expectedOut}
      outputDecimals={outputToken?.decimals ?? 18}
      outputSymbol={outputToken?.symbol}
      showSwapRow={withdrawToken !== resolvedDisplayAssetAddress && !isUnstake}
      withdrawAmountSimple={
        withdrawAmount.bn > 0n ? formatWidgetValue(withdrawAmount.bn, assetToken?.decimals ?? 18) : '0'
      }
      withdrawAmountBn={withdrawAmount.bn}
      assetDecimals={assetToken?.decimals ?? 18}
      assetUsdPrice={assetTokenPrice}
      assetSymbol={assetToken?.symbol}
      outputUsdPrice={outputTokenPrice}
      routeType={routeType}
      onShowDetailsModal={() => setShowWithdrawDetailsModal(true)}
      allowance={needsApproval ? activeFlow.periphery.allowance : undefined}
      allowanceTokenDecimals={needsApproval ? (vault?.decimals ?? 18) : undefined}
      allowanceTokenSymbol={needsApproval ? vault?.symbol : undefined}
      onAllowanceClick={onAllowanceClick}
    />
  )

  const priceImpactWarning = priceImpactInfo.isHigh &&
    !activeFlow.periphery.isLoadingRoute &&
    !withdrawAmount.isDebouncing &&
    withdrawAmount.bn === withdrawAmount.debouncedBn &&
    withdrawAmount.bn > 0n && (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
        <p className="text-sm text-red-500">
          Price impact is high ({priceImpactInfo.percentage.toFixed(2)}%). Consider withdrawing less or waiting for
          better liquidity conditions.
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasAcceptedPriceImpact}
            onChange={(e) => setHasAcceptedPriceImpact(e.target.checked)}
            className="size-4 rounded border-red-500/50 bg-transparent text-red-500 focus:ring-red-500/50"
          />
          <span className="text-sm text-red-500">I understand and wish to continue</span>
        </label>
      </div>
    )

  const actionRow = (
    <div className="flex flex-col gap-3">
      {priceImpactWarning}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          {!account ? (
            <Button
              onClick={openLoginModal}
              variant="filled"
              className="w-full"
              classNameOverride="yearn--button--nextgen w-full"
            >
              Connect Wallet
            </Button>
          ) : (
            <Button
              onClick={() => setShowTransactionOverlay(true)}
              variant={activeFlow.periphery.isLoadingRoute ? 'busy' : 'filled'}
              isBusy={activeFlow.periphery.isLoadingRoute}
              disabled={isWithdrawButtonDisabled || (priceImpactInfo.isHigh && !hasAcceptedPriceImpact)}
              className="w-full"
              classNameOverride="yearn--button--nextgen w-full"
            >
              {withdrawButtonLabel}
            </Button>
          )}
        </div>
        {showSettingsButton ? (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open transaction settings"
            aria-pressed={isSettingsOpen}
            className={cl(
              'flex items-center justify-center rounded-md border border-transparent px-3 py-2 text-text-secondary transition-all duration-200',
              'min-h-11',
              isSettingsOpen
                ? 'bg-surface text-text-primary !border-border'
                : 'bg-surface-secondary hover:bg-surface hover:text-text-primary'
            )}
          >
            <IconSettings className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <div
      className={cl('flex flex-col relative h-full', {
        'border border-border': !hideContainerBorder,
        'rounded-lg': !hideContainerBorder && !disableBorderRadius
      })}
      data-tour="vault-detail-withdraw-widget"
    >
      <WidgetHeader title="Withdraw" actions={headerActions} />
      <div className="flex flex-col flex-1 p-6 pt-2 gap-3">
        <div>
          {/* Withdraw From Selector */}
          {hasBothBalances && <SourceSelector value={withdrawalSource} onChange={setWithdrawalSource} />}

          {/* Amount Section */}
          <div className="flex flex-col gap-4">
            <InputTokenAmount
              input={withdrawInput}
              title="Amount"
              placeholder="0.00"
              balance={effectiveMaxWithdrawAssets}
              decimals={assetToken?.decimals ?? 18}
              symbol={assetToken?.symbol || 'tokens'}
              disabled={disableAmountInput || (!!hasBothBalances && !withdrawalSource)}
              errorMessage={effectiveWithdrawError || undefined}
              inputTokenUsdPrice={assetTokenPrice}
              outputTokenUsdPrice={outputTokenPrice}
              tokenAddress={assetToken?.address}
              tokenChainId={assetToken?.chainID}
              showTokenSelector={canShowAssetTokenSelector}
              onTokenSelectorClick={canOpenTokenSelector ? () => setShowTokenSelector(true) : undefined}
              onInputChange={(value: bigint) => {
                if (value === effectiveMaxWithdrawAssets) {
                  const exactAmount = formatUnits(effectiveMaxWithdrawAssets, assetToken?.decimals ?? 18)
                  withdrawInput[2](exactAmount)
                }
              }}
              zapToken={zapToken}
              onRemoveZap={onRemoveZap}
              zapNotificationText={zapNotificationText}
            />
          </div>

          {contentBelowInput}
        </div>

        {!hideActionButton ? (
          collapseDetails ? (
            <>
              <button
                type="button"
                onClick={() => setIsDetailsPanelOpen(true)}
                aria-expanded={isDetailsPanelOpen}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface"
              >
                <span>Your Transaction Details</span>
                <IconChevron className="size-4 text-text-secondary" direction="right" />
              </button>
              {!hideActionButton ? actionRow : null}
            </>
          ) : (
            <>
              {/* Details Section */}
              {detailsSection}

              {/* Action Button */}
              {!hideActionButton ? actionRow : null}
            </>
          )
        ) : null}
      </div>

      {collapseDetails && isDetailsPanelOpen && !hideActionButton ? (
        <div className="absolute inset-0 z-10 bg-surface rounded-lg flex flex-col">
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
            <span className="text-base font-semibold text-text-primary">Your Transaction Details</span>
            <button
              type="button"
              onClick={() => setIsDetailsPanelOpen(false)}
              aria-label="Close transaction details"
              className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
            >
              <IconCross className="size-3.5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">{detailsSection}</div>
          {!hideActionButton ? <div className="border-t border-border px-6 py-4">{actionRow}</div> : null}
        </div>
      ) : null}

      {onOpenSettings ? (
        <SettingsPanel isActive={isSettingsVisible} onClose={onOpenSettings} variant="overlay" />
      ) : null}

      {/* Transaction Overlay */}
      <TransactionOverlay
        isOpen={showTransactionOverlay}
        onClose={() => setShowTransactionOverlay(false)}
        step={currentStep}
        isLastStep={!needsApproval}
        autoContinueToNextStep
        autoContinueStepLabels={['Approve', 'Sign Permit']}
        onAllComplete={handleWithdrawSuccess}
      />

      {/* Withdraw Details Overlay */}
      <WithdrawDetailsOverlay
        isOpen={showWithdrawDetailsModal}
        onClose={() => setShowWithdrawDetailsModal(false)}
        sourceTokenSymbol={withdrawalSource === 'staking' ? stakingToken?.symbol || vaultSymbol : vaultSymbol}
        vaultAssetSymbol={assetToken?.symbol || ''}
        outputTokenSymbol={outputToken?.symbol || ''}
        withdrawAmount={requiredShares > 0n ? formatWidgetValue(requiredShares, sharesDecimals) : '0'}
        expectedOutput={
          activeFlow.periphery.expectedOut > 0n
            ? formatWidgetValue(activeFlow.periphery.expectedOut, outputToken?.decimals ?? 18)
            : undefined
        }
        hasInputValue={withdrawAmount.bn > 0n}
        stakingAddress={stakingAddress}
        withdrawalSource={withdrawalSource}
        routeType={routeType}
        isZap={routeType === 'ENSO' && shouldShowZapUi}
        isLoadingQuote={activeFlow.periphery.isLoadingRoute}
      />

      {/* Full-screen Token Selector Overlay */}
      <TokenSelectorOverlay
        isOpen={showTokenSelector}
        onClose={() => setShowTokenSelector(false)}
        onChange={(address, chainIdValue) => {
          setSelectedToken(address)
          setSelectedChainId(chainIdValue)
          setWithdrawInput('')
          setShowTokenSelector(false)
          activeFlow.periphery.resetQuote?.()
        }}
        chainId={chainId}
        value={selectedToken}
        excludeTokens={stakingAddress ? [stakingAddress] : undefined}
        priorityTokens={priorityTokens}
        assetAddress={resolvedDisplayAssetAddress}
        vaultAddress={vaultAddress}
        stakingAddress={stakingAddress}
      />
    </div>
  )
}
