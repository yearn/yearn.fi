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
import { cl, formatTAmount, toAddress, toNormalizedBN } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { ApprovalOverlay } from '../deposit/ApprovalOverlay'
import { InputTokenAmount } from '../InputTokenAmount'
import { SettingsPanel } from '../SettingsPanel'
import { TokenSelectorOverlay } from '../shared/TokenSelectorOverlay'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { useResetEnsoSelection } from '../shared/useResetEnsoSelection'
import { formatWidgetAllowance, formatWidgetValue } from '../shared/valueDisplay'
import { WidgetHeader } from '../shared/WidgetHeader'
import { getPriorityTokens } from './constants'
import { SourceSelector } from './SourceSelector'
import type { WithdrawalSource, WithdrawWidgetProps } from './types'
import { useWithdrawError } from './useWithdrawError'
import { useWithdrawFlow } from './useWithdrawFlow'
import { useWithdrawNotifications } from './useWithdrawNotifications'
import { WithdrawDetails } from './WithdrawDetails'
import { WithdrawDetailsOverlay } from './WithdrawDetailsOverlay'
import {
  buildWithdrawTransactionStep,
  getWithdrawCtaLabel,
  getWithdrawTransactionName,
  isWithdrawCtaDisabled,
  isWithdrawLastStep
} from './withdrawStepHelpers'

type WidgetWithdrawProps = WithdrawWidgetProps & {
  hideSettings?: boolean
  disableBorderRadius?: boolean
  collapseDetails?: boolean
  contentBelowInput?: ReactNode
  hideContainerBorder?: boolean
  onTokenSelectionChange?: (address: `0x${string}`, chainId: number) => void
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

function getWithdrawActionLabel(isUnstake: boolean, withdrawalSource: WithdrawalSource): string {
  if (isUnstake) {
    return 'You will unstake'
  }
  if (withdrawalSource === 'staking') {
    return 'You will unstake and redeem'
  }
  return 'You will redeem'
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

type ApprovalState = {
  hasApprovalStep: boolean
  isAllowanceSufficient: boolean
  needsApproval: boolean
  tokenSymbol?: string
  tokenDecimals: number
  spenderAddress: `0x${string}`
  spenderName?: string
}

export function WidgetWithdraw({
  vaultAddress,
  assetAddress,
  displayAssetAddress,
  stakingAddress,
  chainId,
  vaultSymbol,
  stakingSource,
  vaultVersion,
  vaultUserData,
  inputBalanceOverride,
  maxWithdrawAssets,
  requiredSharesOverride,
  expectedOutOverride,
  isActionDisabled = false,
  actionDisabledReason,
  customErrorMessage,
  disableFlow = false,
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
  const [showApprovalOverlay, setShowApprovalOverlay] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [withdrawalSource, setWithdrawalSource] = useState<WithdrawalSource>(stakingAddress ? null : 'vault')
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)
  const [priceImpactAcceptance, setPriceImpactAcceptance] = useState<{ key: string; isAccepted: boolean }>({
    key: '',
    isAccepted: false
  })
  const appliedPrefillRef = useRef<string | null>(null)
  const [fallbackStep, setFallbackStep] = useState<'unstake' | 'withdraw'>('unstake')
  const [redeemSharesOverride, setRedeemSharesOverride] = useState<bigint>(0n)
  const [awaitingPostUnstakeShares, setAwaitingPostUnstakeShares] = useState(false)
  const [vaultSharesBeforeUnstake, setVaultSharesBeforeUnstake] = useState<bigint>(0n)
  const [optimisticApprovedShares, setOptimisticApprovedShares] = useState<bigint | null>(null)

  const {
    assetToken,
    vaultToken: vault,
    stakingToken,
    stakingWithdrawableAssets,
    stakingRedeemableShares,
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
  const hasStakingBalance = stakingWithdrawableAssets > 0n
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

  useEffect(() => {
    if (!showTransactionOverlay) {
      setFallbackStep('unstake')
      setRedeemSharesOverride(0n)
      setAwaitingPostUnstakeShares(false)
      setVaultSharesBeforeUnstake(0n)
    }
  }, [showTransactionOverlay])

  const sourceVaultSharesRaw = useMemo(() => {
    if (withdrawalSource === 'vault') return vault?.balance.raw ?? 0n
    if (withdrawalSource === 'staking') return stakingWithdrawableAssets
    return 0n
  }, [withdrawalSource, vault?.balance.raw, stakingWithdrawableAssets])

  const sourceToken =
    withdrawalSource === 'vault'
      ? vaultAddress
      : withdrawalSource === 'staking' && stakingAddress
        ? stakingAddress
        : vaultAddress

  const isUnstake = withdrawalSource === 'staking' && toAddress(withdrawToken) === toAddress(vaultAddress)

  const sharesDecimals = vault?.decimals ?? stakingToken?.decimals ?? 18
  const vaultDecimals = vault?.decimals ?? 18

  const totalBalanceInUnderlying = useMemo(() => {
    if (pricePerShare === 0n || sourceVaultSharesRaw === 0n || !assetToken) {
      return toNormalizedBN(0n, assetToken?.decimals ?? 18)
    }
    const underlyingAmount = (sourceVaultSharesRaw * pricePerShare) / 10n ** BigInt(vaultDecimals)
    return toNormalizedBN(underlyingAmount, assetToken.decimals ?? 18)
  }, [sourceVaultSharesRaw, pricePerShare, vaultDecimals, assetToken])

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
  const effectiveMaxWithdrawAssets = useMemo(() => {
    if (maxWithdrawAssets === undefined) {
      return totalBalanceInUnderlying.raw
    }

    // Wrapper-owned flows like locked yvUSD can provide an authoritative contract-quoted max
    // that is slightly above the widget's PPS-derived balance estimate.
    if (inputBalanceOverride !== undefined || disableFlow) {
      return maxWithdrawAssets
    }

    return maxWithdrawAssets < totalBalanceInUnderlying.raw ? maxWithdrawAssets : totalBalanceInUnderlying.raw
  }, [maxWithdrawAssets, totalBalanceInUnderlying.raw, inputBalanceOverride, disableFlow])
  const inputBalance = inputBalanceOverride ?? effectiveMaxWithdrawAssets

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
    if (isMaxWithdraw && sourceVaultSharesRaw > 0n) return sourceVaultSharesRaw

    if (pricePerShare > 0n) {
      const numerator = withdrawAmount.bn * 10n ** BigInt(vaultDecimals)
      return (numerator + pricePerShare - 1n) / pricePerShare
    }

    return 0n
  }, [withdrawAmount.bn, isMaxWithdraw, sourceVaultSharesRaw, pricePerShare, vaultDecimals])
  const effectiveRequiredShares = requiredSharesOverride ?? requiredShares
  const flowCurrentAmount = disableFlow ? 0n : withdrawAmount.bn
  const flowDebouncedAmount = disableFlow ? 0n : withdrawAmount.debouncedBn
  const flowRequiredShares = disableFlow ? 0n : effectiveRequiredShares
  const flowIsMaxWithdraw = disableFlow ? false : isMaxWithdraw

  useEffect(() => {
    if (!awaitingPostUnstakeShares || fallbackStep !== 'withdraw') return

    const currentVaultShares = vault?.balance.raw ?? 0n
    if (currentVaultShares <= vaultSharesBeforeUnstake) return

    setRedeemSharesOverride(currentVaultShares - vaultSharesBeforeUnstake)
    setAwaitingPostUnstakeShares(false)
  }, [awaitingPostUnstakeShares, fallbackStep, vault?.balance.raw, vaultSharesBeforeUnstake])

  const blockDirectWithdrawStep = fallbackStep === 'withdraw' && awaitingPostUnstakeShares

  const { routeType, activeFlow, directWithdrawFlow, directUnstakeFlow } = useWithdrawFlow({
    withdrawToken,
    assetAddress,
    vaultAddress,
    sourceToken,
    stakingAddress,
    stakingSource,
    amount: flowDebouncedAmount,
    currentAmount: flowCurrentAmount,
    requiredShares: flowRequiredShares,
    maxShares: sourceVaultSharesRaw,
    redeemSharesOverride,
    isMaxWithdraw: flowIsMaxWithdraw,
    unstakeMaxRedeemShares: withdrawalSource === 'staking' ? stakingRedeemableShares : 0n,
    allowDirectWithdrawStep: !disableFlow && !blockDirectWithdrawStep,
    optimisticApprovedShares,
    account,
    chainId,
    destinationChainId,
    outputChainId: outputToken?.chainID ?? chainId,
    vaultDecimals: vault?.decimals ?? 18,
    outputDecimals: outputToken?.decimals ?? 18,
    pricePerShare,
    slippage: zapSlippage,
    withdrawalSource,
    isUnstake,
    isDebouncing: disableFlow ? false : withdrawAmount.isDebouncing,
    useErc4626: usesErc4626
  })
  const effectiveDirectWithdrawPrepare = blockDirectWithdrawStep
    ? undefined
    : directWithdrawFlow.actions.prepareWithdraw
  const effectiveWithdrawAmountRaw = expectedOutOverride ?? withdrawAmount.bn

  useEffect(() => {
    if (optimisticApprovedShares !== null && activeFlow.periphery.allowance >= optimisticApprovedShares) {
      setOptimisticApprovedShares(null)
    }
  }, [activeFlow.periphery.allowance, optimisticApprovedShares])

  useEffect(() => {
    if (optimisticApprovedShares === null) return
    if (activeFlow.actions.prepareWithdraw.isSuccess) return
    void activeFlow.actions.prepareWithdraw.refetch?.()
  }, [
    optimisticApprovedShares,
    activeFlow.actions.prepareWithdraw.isSuccess,
    activeFlow.actions.prepareWithdraw.refetch
  ])

  const isCrossChain = destinationChainId !== chainId
  const effectiveExpectedOut = expectedOutOverride ?? activeFlow.periphery.expectedOut
  const { approveNotificationParams, unstakeNotificationParams, withdrawNotificationParams } = useWithdrawNotifications(
    {
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
      requiredShares: effectiveRequiredShares,
      expectedOut: effectiveExpectedOut,
      routeType,
      routerAddress: activeFlow.periphery.routerAddress,
      isCrossChain,
      withdrawalSource: withdrawalSource || 'vault'
    }
  )

  const withdrawError = useWithdrawError({
    amount: flowCurrentAmount,
    debouncedAmount: flowDebouncedAmount,
    isDebouncing: disableFlow ? false : withdrawAmount.isDebouncing,
    requiredShares: flowRequiredShares,
    totalBalance: sourceVaultSharesRaw,
    account,
    isLoadingRoute: activeFlow.periphery.isLoadingRoute,
    flowError: activeFlow.periphery.error,
    routeType,
    hasBothBalances: !!hasBothBalances,
    withdrawalSource
  })
  const exceedsExternalWithdrawLimit = maxWithdrawAssets !== undefined && withdrawAmount.bn > effectiveMaxWithdrawAssets
  const effectiveWithdrawError =
    customErrorMessage ||
    actionDisabledReason ||
    (exceedsExternalWithdrawLimit ? 'Amount exceeds currently available withdraw limit.' : undefined) ||
    withdrawError
  const isFetchingQuote = routeType === 'ENSO' && Boolean(activeFlow.periphery.isLoadingRoute)

  const actionLabel = getWithdrawActionLabel(isUnstake, withdrawalSource)
  const transactionName = getWithdrawTransactionName(routeType, isFetchingQuote)

  const approvalState = useMemo((): ApprovalState => {
    const hasApprovalStep = Boolean(activeFlow.actions.prepareApprove)
    const isAllowanceSufficient =
      activeFlow.periphery.isAllowanceSufficient ||
      (optimisticApprovedShares !== null && optimisticApprovedShares >= effectiveRequiredShares)
    const approvalToken = withdrawalSource === 'staking' ? stakingToken : vault

    return {
      hasApprovalStep,
      isAllowanceSufficient,
      needsApproval: hasApprovalStep && !isAllowanceSufficient,
      tokenSymbol: approvalToken?.symbol,
      tokenDecimals: approvalToken?.decimals ?? 18,
      spenderAddress: toAddress(activeFlow.periphery.routerAddress || sourceToken),
      spenderName: routeType === 'ENSO' ? 'Enso Router' : activeFlow.periphery.routerAddress ? 'Vault Zap' : undefined
    }
  }, [
    activeFlow.actions.prepareApprove,
    activeFlow.periphery.isAllowanceSufficient,
    activeFlow.periphery.routerAddress,
    optimisticApprovedShares,
    effectiveRequiredShares,
    withdrawalSource,
    stakingToken,
    vault,
    sourceToken,
    routeType
  ])

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
      Number(formatUnits(effectiveExpectedOut, outputToken?.decimals ?? 18)) * outputTokenPrice
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
    effectiveExpectedOut,
    outputToken?.decimals,
    outputTokenPrice
  ])

  const priceImpactAcceptanceKey = useMemo(() => {
    return [
      withdrawAmount.bn.toString(),
      effectiveRequiredShares.toString(),
      routeType,
      withdrawalSource ?? '',
      sourceToken,
      withdrawToken,
      destinationChainId,
      activeFlow.periphery.routerAddress ?? '',
      effectiveExpectedOut.toString()
    ].join(':')
  }, [
    withdrawAmount.bn,
    effectiveRequiredShares,
    routeType,
    withdrawalSource,
    sourceToken,
    withdrawToken,
    destinationChainId,
    activeFlow.periphery.routerAddress,
    effectiveExpectedOut
  ])
  const hasAcceptedPriceImpact =
    priceImpactAcceptance.key === priceImpactAcceptanceKey && priceImpactAcceptance.isAccepted

  const canOpenTokenSelector = ensoEnabled && !disableTokenSelector
  const shouldShowZapUi = !isBaseWithdrawToken
  const canShowAssetTokenSelector = canOpenTokenSelector && !shouldShowZapUi

  const zapToken = useMemo(() => {
    if (!shouldShowZapUi) return undefined

    const getExpectedAmount = () => {
      if (isUnstake) {
        return effectiveRequiredShares > 0n ? formatWidgetValue(effectiveRequiredShares, vault?.decimals ?? 18) : '0'
      }
      return effectiveExpectedOut > 0n ? formatWidgetValue(effectiveExpectedOut, outputToken?.decimals ?? 18) : '0'
    }

    return {
      symbol: outputToken?.symbol || 'Select Token',
      address: outputToken?.address || '',
      chainId: outputToken?.chainID || chainId,
      expectedAmount: getExpectedAmount(),
      isLoading: isUnstake ? false : isFetchingQuote
    }
  }, [
    shouldShowZapUi,
    isUnstake,
    effectiveRequiredShares,
    vault?.decimals,
    effectiveExpectedOut,
    isFetchingQuote,
    outputToken?.symbol,
    outputToken?.address,
    outputToken?.chainID,
    outputToken?.decimals,
    chainId
  ])

  const formattedWithdrawAmount = formatTAmount({
    value: effectiveWithdrawAmountRaw,
    decimals: assetToken?.decimals ?? 18
  })
  const formattedRequiredShares = formatTAmount({ value: effectiveRequiredShares, decimals: sharesDecimals })
  const formattedApprovalAmount = formatTAmount({ value: effectiveRequiredShares, decimals: sharesDecimals })

  const currentStep: TransactionStep | undefined = useMemo(
    () =>
      buildWithdrawTransactionStep({
        needsApproval: approvalState.needsApproval,
        approvePrepare: activeFlow.actions.prepareApprove,
        activeWithdrawPrepare: activeFlow.actions.prepareWithdraw,
        directUnstakePrepare: directUnstakeFlow.actions.prepareWithdraw,
        directWithdrawPrepare: effectiveDirectWithdrawPrepare,
        fallbackStep,
        routeType,
        isCrossChain,
        formattedApprovalAmount,
        approvalTokenSymbol: approvalState.tokenSymbol,
        formattedRequiredShares,
        formattedWithdrawAmount,
        assetTokenSymbol: assetToken?.symbol,
        vaultSymbol: vault?.symbol,
        stakingTokenSymbol: stakingToken?.symbol,
        approveNotificationParams,
        unstakeNotificationParams,
        withdrawNotificationParams
      }),
    [
      approvalState.needsApproval,
      activeFlow.actions.prepareApprove,
      activeFlow.actions.prepareWithdraw,
      directUnstakeFlow.actions.prepareWithdraw,
      effectiveDirectWithdrawPrepare,
      fallbackStep,
      routeType,
      isCrossChain,
      formattedApprovalAmount,
      approvalState.tokenSymbol,
      formattedRequiredShares,
      formattedWithdrawAmount,
      assetToken?.symbol,
      vault?.symbol,
      stakingToken?.symbol,
      approveNotificationParams,
      unstakeNotificationParams,
      withdrawNotificationParams
    ]
  )

  const isLastStep = useMemo(
    () =>
      isWithdrawLastStep({
        currentStep,
        needsApproval: approvalState.needsApproval,
        routeType
      }),
    [currentStep, approvalState.needsApproval, routeType]
  )

  const handleTransactionStepSuccess = useCallback(
    (label: string) => {
      if (routeType === 'DIRECT_UNSTAKE_WITHDRAW' && label === 'Unstake') {
        setFallbackStep('withdraw')
        setWithdrawalSource('vault')
        setAwaitingPostUnstakeShares(isMaxWithdraw)
        setRedeemSharesOverride(isMaxWithdraw ? 0n : effectiveRequiredShares)
        const tokensToRefresh = [{ address: vaultAddress, chainID: chainId }]
        if (stakingAddress) {
          tokensToRefresh.push({ address: stakingAddress, chainID: chainId })
        }
        void refreshWalletBalances(tokensToRefresh)
        refetchVaultUserData()
      } else if (label === 'Approve') {
        setOptimisticApprovedShares(effectiveRequiredShares)
      }
    },
    [
      routeType,
      isMaxWithdraw,
      effectiveRequiredShares,
      vaultAddress,
      chainId,
      stakingAddress,
      refreshWalletBalances,
      refetchVaultUserData
    ]
  )

  const handleOpenTransactionOverlay = useCallback(() => {
    if (routeType === 'DIRECT_UNSTAKE_WITHDRAW' && fallbackStep === 'unstake' && isMaxWithdraw) {
      setVaultSharesBeforeUnstake(vault?.balance.raw ?? 0n)
    }
    setShowTransactionOverlay(true)
  }, [routeType, fallbackStep, isMaxWithdraw, vault?.balance.raw])

  const handleWithdrawSuccess = useCallback(() => {
    const sharesToWithdraw = formatUnits(effectiveWithdrawAmountRaw, assetToken?.decimals ?? 18)
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
    effectiveWithdrawAmountRaw,
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
    approvalState.hasApprovalStep && activeFlow.periphery.allowance > 0n && pricePerShare > 0n
      ? (): void => {
          const underlyingAmount =
            (activeFlow.periphery.allowance * pricePerShare) / 10n ** BigInt(vault?.decimals ?? 18)
          setWithdrawInput(formatUnits(underlyingAmount, assetToken?.decimals ?? 18))
        }
      : undefined
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
      requiredShares={effectiveRequiredShares}
      sharesDecimals={sharesDecimals}
      isLoadingQuote={isFetchingQuote}
      isQuoteStale={withdrawAmount.isDebouncing || withdrawAmount.bn !== withdrawAmount.debouncedBn}
      expectedOut={effectiveExpectedOut}
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
      allowance={approvalState.hasApprovalStep ? activeFlow.periphery.allowance : undefined}
      allowanceTokenDecimals={approvalState.hasApprovalStep ? approvalState.tokenDecimals : undefined}
      allowanceTokenSymbol={approvalState.hasApprovalStep ? approvalState.tokenSymbol : undefined}
      approvalSpenderName={approvalState.hasApprovalStep ? approvalState.spenderName : undefined}
      onAllowanceClick={onAllowanceClick}
      onShowApprovalOverlay={approvalState.hasApprovalStep ? () => setShowApprovalOverlay(true) : undefined}
    />
  )

  const priceImpactWarning = priceImpactInfo.isHigh &&
    !isFetchingQuote &&
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
            onChange={(e) =>
              setPriceImpactAcceptance({
                key: priceImpactAcceptanceKey,
                isAccepted: e.target.checked
              })
            }
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
              onClick={handleOpenTransactionOverlay}
              variant={isFetchingQuote ? 'busy' : 'filled'}
              isBusy={isFetchingQuote}
              disabled={
                isWithdrawCtaDisabled({
                  hasError: !!effectiveWithdrawError || isActionDisabled,
                  withdrawAmountRaw: withdrawAmount.bn,
                  isFetchingQuote,
                  isDebouncing: withdrawAmount.isDebouncing,
                  showApprove: approvalState.hasApprovalStep,
                  isAllowanceSufficient: approvalState.isAllowanceSufficient,
                  prepareApproveEnabled: Boolean(activeFlow.periphery.prepareApproveEnabled),
                  prepareWithdrawEnabled: Boolean(activeFlow.periphery.prepareWithdrawEnabled)
                }) ||
                (priceImpactInfo.isHigh && !hasAcceptedPriceImpact)
              }
              className="w-full"
              classNameOverride="yearn--button--nextgen w-full"
            >
              {getWithdrawCtaLabel({
                isFetchingQuote,
                showApprove: approvalState.hasApprovalStep,
                isAllowanceSufficient: approvalState.isAllowanceSufficient,
                transactionName
              })}
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
              balance={inputBalance}
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
                if (value === inputBalance) {
                  const exactAmount = formatUnits(inputBalance, assetToken?.decimals ?? 18)
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
        isLastStep={isLastStep}
        autoContinueToNextStep
        autoContinueStepLabels={['Approve', 'Sign Permit', 'Unstake']}
        onStepSuccess={handleTransactionStepSuccess}
        onAllComplete={handleWithdrawSuccess}
      />

      {/* Withdraw Details Overlay */}
      <WithdrawDetailsOverlay
        isOpen={showWithdrawDetailsModal}
        onClose={() => setShowWithdrawDetailsModal(false)}
        sourceTokenSymbol={withdrawalSource === 'staking' ? stakingToken?.symbol || vaultSymbol : vaultSymbol}
        vaultAssetSymbol={assetToken?.symbol || ''}
        outputTokenSymbol={outputToken?.symbol || ''}
        withdrawAmount={effectiveRequiredShares > 0n ? formatWidgetValue(effectiveRequiredShares, sharesDecimals) : '0'}
        expectedOutput={
          effectiveExpectedOut > 0n ? formatWidgetValue(effectiveExpectedOut, outputToken?.decimals ?? 18) : undefined
        }
        hasInputValue={withdrawAmount.bn > 0n}
        stakingAddress={stakingAddress}
        withdrawalSource={withdrawalSource}
        routeType={routeType}
        isZap={routeType === 'ENSO' && shouldShowZapUi}
        isLoadingQuote={isFetchingQuote}
      />

      <ApprovalOverlay
        isOpen={showApprovalOverlay}
        onClose={() => {
          setShowApprovalOverlay(false)
          setOptimisticApprovedShares(null)
        }}
        tokenSymbol={approvalState.tokenSymbol || ''}
        tokenAddress={toAddress(sourceToken)}
        tokenDecimals={approvalState.tokenDecimals}
        spenderAddress={approvalState.spenderAddress}
        spenderName={approvalState.spenderName || 'Vault'}
        chainId={chainId}
        currentAllowance={formatWidgetAllowance(activeFlow.periphery.allowance, approvalState.tokenDecimals) || '0'}
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
        mode={'withdraw'}
        priorityTokens={priorityTokens}
        topTokens={priorityTokens}
        assetAddress={resolvedDisplayAssetAddress}
        vaultAddress={vaultAddress}
        stakingAddress={stakingAddress}
      />
    </div>
  )
}
