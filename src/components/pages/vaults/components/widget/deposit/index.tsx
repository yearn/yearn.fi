import { buildSafeDepositBatch } from '@pages/vaults/components/widget/deposit/safeDepositBatch'
import { InputTokenAmount } from '@pages/vaults/components/widget/InputTokenAmount'
import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { useDebouncedInput } from '@pages/vaults/hooks/useDebouncedInput'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenListActions } from '@shared/contexts/WithTokenList'
import { useYearnSpotPrices } from '@shared/hooks/useYearnSpotPrices'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCross } from '@shared/icons/IconCross'
import { IconSettings } from '@shared/icons/IconSettings'
import type { TToken } from '@shared/types'
import { cl, formatTAmount, toAddress } from '@shared/utils'
import { requiresAllowanceResetBeforeApproval } from '@shared/utils/approve'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import {
  calculateRemainingEnsoSlippagePercentage,
  optionalBasisPointsToPercentage,
  ZAP_SLIPPAGE_HARD_CAP
} from '@shared/utils/slippage'
import type { ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits, isAddressEqual } from 'viem'
import { env } from '@/env'
import { SettingsPanel } from '../SettingsPanel'
import { PriceImpactWarning } from '../shared/PriceImpactWarning'
import { TokenSelectorOverlay } from '../shared/TokenSelectorOverlay'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { useResetEnsoSelection } from '../shared/useResetEnsoSelection'
import { useWidgetContext } from '../shared/useWidgetContext'
import { formatWidgetAllowance, formatWidgetValue } from '../shared/valueDisplay'
import { WidgetHeader } from '../shared/WidgetHeader'
import { WidgetLoadingSkeleton } from '../shared/WidgetLoadingSkeleton'
import { getKnownVaultTokenLogoMetaByAddress } from '../tokenLogo.utils'
import { DEPOSIT_COMMON_TOKENS_BY_CHAIN } from '../withdraw/constants'
import { AnnualReturnOverlay } from './AnnualReturnOverlay'
import { ApprovalOverlay } from './ApprovalOverlay'
import { ApprovalResetWarning } from './ApprovalResetWarning'
import { shouldBlockDepositApprovalForAllowanceReset } from './approvalReset'
import { getDepositApprovalSpender } from './approvalSpender'
import { DepositDetails } from './DepositDetails'
import { getStructurallyExcludedDepositTokenAddresses } from './tokenSelectorFiltering'
import type { DepositRouteType } from './types'
import { useDepositError } from './useDepositError'
import { useDepositFlow } from './useDepositFlow'
import { useDepositNotifications } from './useDepositNotifications'
import { useFetchMaxQuote } from './useFetchMaxQuote'
import { VaultSharesOverlay } from './VaultSharesOverlay'
import { VaultShareValueOverlay } from './VaultShareValueOverlay'
import { calculateDepositValueInfo } from './valuation'

interface Props {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  directDepositTokenAddress?: `0x${string}`
  stakingAddress?: `0x${string}`
  disableDepositStaking?: boolean
  chainId: number
  vaultAPR: number
  vaultSymbol: string
  stakingSource?: string
  vaultUserData: VaultUserData
  handleDepositSuccess?: () => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  onAmountChange?: (value: string) => void
  onTokenSelectionChange?: (address: `0x${string}`, chainId: number) => void
  prefill?: {
    address: `0x${string}`
    chainId: number
    amount?: string
    requestKey?: number | string
  }
  onPrefillApplied?: () => void
  onUserTokenSelectionChange?: (address: `0x${string}`, chainId: number) => void
  forceStake?: boolean
  hideSettings?: boolean
  disableBorderRadius?: boolean
  collapseDetails?: boolean
  detailsContent?: ReactNode
  contentBelowInput?: ReactNode
  contentAboveButton?: ReactNode
  actionLabelOverride?: string
  titleOverride?: string
  vaultSharesLabel?: string
  hideDetails?: boolean
  hideActionButton?: boolean
  hideContainerBorder?: boolean
  headerActions?: ReactNode
  tokenSelectorExtraTokens?: TToken[]
  inputTokenLogoURIOverride?: string
  deferSuccessEffectsUntilClose?: boolean
  deferSuccessEffectsUntilConfettiEnd?: boolean
}

type DepositActionCopy = {
  actionLabel: string
  progressLabel: string
  pastTenseLabel: string
}

function getDepositActionCopy(routeType: DepositRouteType): DepositActionCopy {
  if (routeType === 'DIRECT_STAKE') {
    return {
      actionLabel: 'Stake',
      progressLabel: 'Staking',
      pastTenseLabel: 'staked'
    }
  }

  return {
    actionLabel: 'Deposit',
    progressLabel: 'Depositing',
    pastTenseLabel: 'deposited'
  }
}

function getDepositButtonLabel(
  isLoadingRoute: boolean,
  needsApproval: boolean,
  routeType: DepositRouteType,
  actionLabelOverride?: string
): string {
  if (isLoadingRoute) {
    return 'Fetching quote'
  }

  const { actionLabel } = getDepositActionCopy(routeType)
  const resolvedActionLabel = actionLabelOverride ?? actionLabel
  if (needsApproval) {
    return `Approve & ${resolvedActionLabel}`
  }

  return resolvedActionLabel
}

function getTokenLogoURI(token: unknown): string | undefined {
  if (!token || typeof token !== 'object' || !('logoURI' in token)) {
    return undefined
  }

  return typeof token.logoURI === 'string' ? token.logoURI : undefined
}

export function WidgetDeposit({
  vaultAddress,
  assetAddress,
  directDepositTokenAddress,
  stakingAddress,
  disableDepositStaking,
  chainId,
  vaultAPR,
  vaultSymbol,
  stakingSource,
  vaultUserData,
  handleDepositSuccess: onDepositSuccess,
  onOpenSettings,
  isSettingsOpen,
  onAmountChange,
  onTokenSelectionChange,
  prefill,
  onPrefillApplied,
  onUserTokenSelectionChange,
  forceStake = false,
  hideSettings: _hideSettings,
  disableBorderRadius,
  collapseDetails,
  detailsContent,
  contentBelowInput,
  contentAboveButton,
  actionLabelOverride,
  titleOverride,
  vaultSharesLabel,
  hideDetails = false,
  hideActionButton = false,
  hideContainerBorder = false,
  headerActions,
  tokenSelectorExtraTokens,
  inputTokenLogoURIOverride,
  deferSuccessEffectsUntilClose = false,
  deferSuccessEffectsUntilConfettiEnd = true
}: Props): ReactElement {
  const bootstrapEnsoQuoteDebugRef = useRef<Record<string, unknown> | null>(null)
  const lastBootstrapEnsoQuoteDebugKeyRef = useRef<string | null>(null)
  const lastProtectedEnsoQuoteDebugKeyRef = useRef<string | null>(null)
  const {
    account,
    openLoginModal,
    refreshWalletBalances,
    getToken,
    zapSlippage,
    isAutoStakingEnabled,
    trackEvent,
    ensoEnabled,
    isWalletSafe
  } = useWidgetContext({ chainId, vaultAddress })
  const { allVaults, setIsAutoStakingEnabled } = useYearn()
  const { enableTokenListFetch } = useTokenListActions()

  const [showVaultSharesModal, setShowVaultSharesModal] = useState(false)
  const [showVaultShareValueModal, setShowVaultShareValueModal] = useState(false)
  const [showAnnualReturnModal, setShowAnnualReturnModal] = useState(false)
  const [showApprovalOverlay, setShowApprovalOverlay] = useState(false)
  const [disableApprovalOverlaySetUnlimited, setDisableApprovalOverlaySetUnlimited] = useState(false)
  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)
  const [isYBoldAutoStakeWarningDismissing, setIsYBoldAutoStakeWarningDismissing] = useState(false)
  const [isYBoldAutoStakeWarningExiting, setIsYBoldAutoStakeWarningExiting] = useState(false)
  const [approvalRouteRefreshKey, setApprovalRouteRefreshKey] = useState(0)
  const yBoldAutoStakeWarningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const yBoldAutoStakeWarningExitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    assetToken,
    vaultToken: vault,
    stakingToken,
    pricePerShare,
    isLoading: isLoadingVaultData,
    refetch: refetchVaultUserData
  } = vaultUserData

  // ============================================================================
  // Token Selection & Input
  // ============================================================================
  const [selectedToken, setSelectedToken] = useState<`0x${string}` | undefined>(prefill?.address ?? assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(prefill?.chainId)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const appliedPrefillRef = useRef<string | null>(null)

  // Derived token values
  const depositToken = selectedToken || assetAddress
  const sourceChainId = selectedChainId || chainId
  const isNativeToken = toAddress(depositToken) === toAddress(ETH_TOKEN_ADDRESS)
  const selectedExtraToken = useMemo(
    () =>
      tokenSelectorExtraTokens?.find(
        (token) => token.chainID === sourceChainId && toAddress(token.address) === toAddress(depositToken)
      ),
    [tokenSelectorExtraTokens, sourceChainId, depositToken]
  )
  const tokenSelectorExcludedTokens = useMemo(() => {
    const excluded = new Set<string>([toAddress(vaultAddress).toLowerCase()])

    if (stakingAddress) {
      excluded.add(toAddress(stakingAddress).toLowerCase())
    }

    getStructurallyExcludedDepositTokenAddresses({
      allVaults,
      destinationVaultAddress: vaultAddress
    }).forEach((address) => {
      excluded.add(toAddress(address).toLowerCase())
    })

    return [...excluded].map((address) => toAddress(address))
  }, [allVaults, stakingAddress, vaultAddress])
  const tokenSelectorTopTokens = useMemo(() => {
    const topTokens: Record<number, `0x${string}`[]> = { ...DEPOSIT_COMMON_TOKENS_BY_CHAIN }
    const orderedAddresses = [assetAddress, ...(topTokens[chainId] || [])]
    topTokens[chainId] = [...new Set(orderedAddresses.map((address) => toAddress(address) as `0x${string}`))]
    return topTokens
  }, [assetAddress, chainId])

  const inputToken = useMemo(() => {
    if (sourceChainId === chainId && depositToken === assetAddress) {
      return assetToken
    }
    if (selectedExtraToken) {
      return selectedExtraToken
    }
    return getToken({ address: depositToken, chainID: sourceChainId })
  }, [getToken, depositToken, sourceChainId, chainId, assetAddress, assetToken, selectedExtraToken])
  const { getPrice } = useYearnSpotPrices([
    { address: inputToken?.address, chainID: inputToken?.chainID },
    { address: assetToken?.address, chainID: assetToken?.chainID }
  ])
  const knownVaultTokenLogoMetaByAddress = useMemo(
    () => getKnownVaultTokenLogoMetaByAddress({ allVaults, chainId: sourceChainId }),
    [allVaults, sourceChainId]
  )
  const knownInputTokenLogoToken = inputToken?.address
    ? knownVaultTokenLogoMetaByAddress[toAddress(inputToken.address).toLowerCase()]?.logoToken
    : undefined
  const inputTokenLogoURI =
    inputTokenLogoURIOverride ??
    selectedExtraToken?.logoURI ??
    (knownInputTokenLogoToken ? knownInputTokenLogoToken.logoURI : getTokenLogoURI(inputToken))
  const inputTokenLogoAddress = knownInputTokenLogoToken?.address ?? inputToken?.address
  const inputTokenLogoChainID = knownInputTokenLogoToken?.chainID ?? inputToken?.chainID

  const openTokenSelector = (): void => {
    enableTokenListFetch()
    setShowTokenSelector(true)
  }

  const shouldStakeDeposit = forceStake || isAutoStakingEnabled
  const stakingDepositAddress = disableDepositStaking ? undefined : stakingAddress

  const destinationToken = useMemo(() => {
    if (shouldStakeDeposit && stakingDepositAddress) return stakingDepositAddress
    return vaultAddress
  }, [shouldStakeDeposit, stakingDepositAddress, vaultAddress])

  const depositInput = useDebouncedInput(inputToken?.decimals ?? 18)
  const [depositAmount, , setDepositInput] = depositInput
  const shouldCollapseDetails = Boolean(collapseDetails && !hideDetails && !hideActionButton)
  const [ensoQuoteSlippage, setEnsoQuoteSlippage] = useState(0)

  useEffect(() => {
    onAmountChange?.(depositAmount.formValue)
  }, [depositAmount.formValue, onAmountChange])

  useEffect(() => {
    onTokenSelectionChange?.(depositToken, sourceChainId)
  }, [depositToken, onTokenSelectionChange, sourceChainId])

  useEffect(() => {
    if (!prefill) return
    const key = `${prefill.requestKey ?? ''}-${prefill.address}-${prefill.chainId}-${prefill.amount}`
    if (appliedPrefillRef.current === key) return
    appliedPrefillRef.current = key

    const canApplyDirectStakeToken =
      forceStake && toAddress(prefill.address) === toAddress(vaultAddress) && prefill.chainId === chainId
    const canApplyPrefilledToken =
      ensoEnabled ||
      canApplyDirectStakeToken ||
      (toAddress(prefill.address) === toAddress(assetAddress) && prefill.chainId === chainId)

    setSelectedToken(canApplyPrefilledToken ? prefill.address : assetAddress)
    setSelectedChainId(canApplyPrefilledToken ? prefill.chainId : undefined)
    if (prefill.amount !== undefined) {
      setDepositInput(prefill.amount)
    }
    onPrefillApplied?.()
  }, [prefill, ensoEnabled, assetAddress, chainId, forceStake, vaultAddress, setDepositInput, onPrefillApplied])

  useResetEnsoSelection({
    ensoEnabled,
    selectedToken,
    selectedChainId,
    assetAddress,
    allowedTokenAddress: forceStake ? vaultAddress : undefined,
    chainId,
    showTokenSelector,
    setSelectedToken,
    setSelectedChainId,
    setShowTokenSelector
  })

  // Render-time state adjustment: close panel when collapse is disabled
  if (!shouldCollapseDetails && isDetailsPanelOpen) {
    setIsDetailsPanelOpen(false)
  }

  const { routeType, activeFlow } = useDepositFlow({
    depositToken,
    assetAddress,
    directDepositTokenAddress,
    destinationToken,
    vaultAddress,
    stakingAddress: stakingDepositAddress,
    amount: depositAmount.debouncedBn,
    currentAmount: depositAmount.bn,
    account,
    chainId,
    sourceChainId,
    destinationChainId: vault?.chainID,
    inputDecimals: inputToken?.decimals ?? 18,
    vaultDecimals: vault?.decimals ?? 18,
    slippage: ensoQuoteSlippage,
    ensoRoutingStrategy: isWalletSafe ? 'router' : undefined,
    routeRefreshKey: approvalRouteRefreshKey,
    stakingSource
  })

  const isCrossChain = sourceChainId !== chainId
  const isEnsoRoute = routeType === 'ENSO'
  const ensoRouteHasSwap = isEnsoRoute && Boolean(activeFlow.periphery.routeHasSwap)
  const { approveNotificationParams, depositNotificationParams } = useDepositNotifications({
    inputToken,
    vault,
    stakingToken,
    depositToken,
    assetAddress,
    destinationToken,
    stakingAddress: stakingDepositAddress,
    account,
    sourceChainId,
    chainId,
    depositAmount: depositAmount.debouncedBn,
    expectedShareAmount: isEnsoRoute ? activeFlow.periphery.minExpectedOut : activeFlow.periphery.expectedOut,
    routeType,
    routerAddress: activeFlow.periphery.routerAddress,
    isCrossChain
  })

  const depositError = useDepositError({
    amount: depositAmount.bn,
    debouncedAmount: depositAmount.debouncedBn,
    isDebouncing: depositAmount.isDebouncing,
    balance: inputToken?.balance.raw || 0n,
    account,
    isLoadingRoute: activeFlow.periphery.isLoadingRoute,
    flowError: activeFlow.periphery.error,
    routeType,
    selectedToken,
    vaultAddress,
    isAutoStakingEnabled: shouldStakeDeposit
  })

  const willReceiveStakedShares = routeType === 'DIRECT_STAKE' || (shouldStakeDeposit && !!stakingDepositAddress)
  const receivedSharesLabel = willReceiveStakedShares ? 'Staked shares' : (vaultSharesLabel ?? 'Vault shares')
  const sharesDecimals = willReceiveStakedShares
    ? (stakingToken?.decimals ?? vault?.decimals ?? 18)
    : (vault?.decimals ?? 18)
  const vaultDecimals = vault?.decimals ?? 18
  const normalizedExpectedOut = activeFlow.periphery.normalizedExpectedOut
  const normalizedMinExpectedOut = activeFlow.periphery.normalizedMinExpectedOut
  const isLoadingQuote = activeFlow.periphery.isLoadingRoute || activeFlow.periphery.isLoadingExpectedOutNormalization

  const estimatedAnnualReturn = useMemo(() => {
    if (depositAmount.debouncedBn === 0n || vaultAPR === 0) return 0
    return Number(formatUnits(depositAmount.debouncedBn, inputToken?.decimals ?? 18)) * vaultAPR
  }, [depositAmount.debouncedBn, inputToken?.decimals, vaultAPR])

  const expectedOutInAsset = useMemo(() => {
    if (normalizedExpectedOut === 0n || !pricePerShare || depositAmount.bn === 0n) return 0n
    return (normalizedExpectedOut * pricePerShare) / 10n ** BigInt(vaultDecimals)
  }, [normalizedExpectedOut, vaultDecimals, pricePerShare, depositAmount.bn])

  const minExpectedOutInAsset = useMemo(() => {
    if (normalizedMinExpectedOut === 0n || !pricePerShare || depositAmount.bn === 0n) return 0n
    return (normalizedMinExpectedOut * pricePerShare) / 10n ** BigInt(vaultDecimals)
  }, [normalizedMinExpectedOut, vaultDecimals, pricePerShare, depositAmount.bn])

  const inputTokenPrice =
    inputToken?.address && inputToken?.chainID
      ? getPrice({ address: toAddress(inputToken.address), chainID: inputToken.chainID }).normalized
      : 0

  const outputTokenPrice =
    depositToken !== assetAddress && assetToken?.address && assetToken?.chainID
      ? getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
      : 0

  const assetTokenPrice =
    assetToken?.address && assetToken?.chainID
      ? getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
      : 0

  const hasInputTokenPrice = inputTokenPrice > 0
  const hasAssetTokenPrice = assetTokenPrice > 0

  // ENSO slippage is calibrated from USD price impact, so re-arm the second
  // quote pass once those price inputs resolve after a cold load.
  const ensoSlippageCalibrationKey = useMemo(
    () =>
      [
        sourceChainId,
        vault?.chainID ?? chainId,
        depositToken,
        destinationToken,
        account ?? 'no-account',
        depositAmount.debouncedBn.toString(),
        zapSlippage,
        hasInputTokenPrice,
        hasAssetTokenPrice
      ].join(':'),
    [
      account,
      chainId,
      depositAmount.debouncedBn,
      depositToken,
      destinationToken,
      hasAssetTokenPrice,
      hasInputTokenPrice,
      sourceChainId,
      vault?.chainID,
      zapSlippage
    ]
  )

  useEffect(() => {
    setEnsoQuoteSlippage(0)
  }, [ensoSlippageCalibrationKey])

  useEffect(() => {
    if (!env.DEV) {
      return
    }

    bootstrapEnsoQuoteDebugRef.current = null
    lastBootstrapEnsoQuoteDebugKeyRef.current = null
    lastProtectedEnsoQuoteDebugKeyRef.current = null
  }, [ensoSlippageCalibrationKey])

  const depositValueInfo = useMemo(
    () =>
      calculateDepositValueInfo({
        depositAmountBn: depositAmount.bn,
        inputTokenDecimals: inputToken?.decimals ?? 18,
        inputTokenUsdPrice: inputTokenPrice,
        normalizedVaultShares: normalizedExpectedOut,
        normalizedMinVaultShares: normalizedMinExpectedOut,
        vaultDecimals,
        pricePerShare: pricePerShare || 0n,
        assetTokenDecimals: assetToken?.decimals ?? 18,
        assetUsdPrice: assetTokenPrice
      }),
    [
      depositAmount.bn,
      inputToken?.decimals,
      inputTokenPrice,
      normalizedExpectedOut,
      normalizedMinExpectedOut,
      vaultDecimals,
      pricePerShare,
      assetToken?.decimals,
      assetTokenPrice
    ]
  )
  const ensoPriceImpactPercentage = isEnsoRoute
    ? optionalBasisPointsToPercentage(activeFlow.periphery.priceImpact)
    : undefined
  const estimatedPriceImpactPercentage =
    isEnsoRoute && ensoPriceImpactPercentage !== undefined
      ? Math.max(depositValueInfo.priceImpactPercentage, ensoPriceImpactPercentage)
      : depositValueInfo.priceImpactPercentage
  const worstCaseRouteImpactPercentage =
    isEnsoRoute && ensoPriceImpactPercentage !== undefined
      ? Math.max(depositValueInfo.worstCasePriceImpactPercentage, ensoPriceImpactPercentage)
      : depositValueInfo.worstCasePriceImpactPercentage
  const desiredEnsoQuoteSlippage = useMemo(
    () =>
      isEnsoRoute
        ? depositValueInfo.hasIncompleteUsdValuation && ensoPriceImpactPercentage === undefined
          ? 0
          : calculateRemainingEnsoSlippagePercentage({
              userTolerancePercentage: zapSlippage,
              quoteImpactPercentage: estimatedPriceImpactPercentage
            })
        : 0,
    [
      depositValueInfo.hasIncompleteUsdValuation,
      ensoPriceImpactPercentage,
      estimatedPriceImpactPercentage,
      isEnsoRoute,
      zapSlippage
    ]
  )

  useEffect(() => {
    if (
      routeType !== 'ENSO' ||
      ensoQuoteSlippage !== 0 ||
      depositAmount.debouncedBn === 0n ||
      isLoadingQuote ||
      desiredEnsoQuoteSlippage <= 0
    ) {
      return
    }

    setEnsoQuoteSlippage(desiredEnsoQuoteSlippage)
  }, [depositAmount.debouncedBn, desiredEnsoQuoteSlippage, ensoQuoteSlippage, isLoadingQuote, routeType])

  const hasBootstrapEnsoQuote =
    isEnsoRoute && ensoQuoteSlippage === 0 && activeFlow.periphery.expectedOut > 0n && depositAmount.debouncedBn > 0n
  const isWaitingForProtectedEnsoQuote = hasBootstrapEnsoQuote && desiredEnsoQuoteSlippage > 0
  const isPreparingEnsoQuote = isLoadingQuote || isWaitingForProtectedEnsoQuote

  useEffect(() => {
    if (
      !env.DEV ||
      routeType !== 'ENSO' ||
      isLoadingQuote ||
      depositAmount.isDebouncing ||
      depositAmount.debouncedBn === 0n ||
      (activeFlow.periphery.expectedOut === 0n && activeFlow.periphery.minExpectedOut === 0n)
    ) {
      return
    }

    const quoteSummary = {
      calibrationKey: ensoSlippageCalibrationKey,
      requestSlippagePercentage: ensoQuoteSlippage,
      desiredProtectedSlippagePercentage: desiredEnsoQuoteSlippage,
      userTolerancePercentage: zapSlippage,
      inputAmountRaw: depositAmount.debouncedBn.toString(),
      expectedOutRaw: activeFlow.periphery.expectedOut.toString(),
      minExpectedOutRaw: activeFlow.periphery.minExpectedOut.toString(),
      normalizedExpectedOutRaw: normalizedExpectedOut.toString(),
      normalizedMinExpectedOutRaw: normalizedMinExpectedOut.toString(),
      expectedOutInAssetRaw: expectedOutInAsset.toString(),
      minExpectedOutInAssetRaw: minExpectedOutInAsset.toString(),
      localPriceImpactPercentage: depositValueInfo.priceImpactPercentage,
      ensoPriceImpactPercentage,
      selectedPriceImpactPercentage: estimatedPriceImpactPercentage,
      localWorstCasePriceImpactPercentage: depositValueInfo.worstCasePriceImpactPercentage,
      selectedWorstCasePriceImpactPercentage: worstCaseRouteImpactPercentage,
      inputTokenSymbol: inputToken?.symbol,
      destinationTokenSymbol: assetToken?.symbol
    }

    if (ensoQuoteSlippage === 0) {
      const bootstrapLogKey = [
        ensoSlippageCalibrationKey,
        activeFlow.periphery.expectedOut.toString(),
        activeFlow.periphery.minExpectedOut.toString()
      ].join(':')

      if (lastBootstrapEnsoQuoteDebugKeyRef.current === bootstrapLogKey) {
        return
      }

      bootstrapEnsoQuoteDebugRef.current = quoteSummary
      lastBootstrapEnsoQuoteDebugKeyRef.current = bootstrapLogKey
      console.log('[ENSO][deposit] bootstrap quote', quoteSummary)
      return
    }

    const protectedLogKey = [
      ensoSlippageCalibrationKey,
      ensoQuoteSlippage.toString(),
      activeFlow.periphery.expectedOut.toString(),
      activeFlow.periphery.minExpectedOut.toString()
    ].join(':')

    if (lastProtectedEnsoQuoteDebugKeyRef.current === protectedLogKey) {
      return
    }

    lastProtectedEnsoQuoteDebugKeyRef.current = protectedLogKey
    console.log('[ENSO][deposit] protected quote comparison', {
      bootstrapQuote: bootstrapEnsoQuoteDebugRef.current,
      protectedQuote: quoteSummary,
      note: 'localPriceImpactPercentage comes from amountOut; localWorstCasePriceImpactPercentage comes from minAmountOut; selected values also include Enso priceImpact when Enso is stricter.'
    })
  }, [
    activeFlow.periphery.expectedOut,
    activeFlow.periphery.minExpectedOut,
    assetToken?.symbol,
    depositAmount.debouncedBn,
    depositAmount.isDebouncing,
    depositValueInfo.priceImpactPercentage,
    depositValueInfo.worstCasePriceImpactPercentage,
    desiredEnsoQuoteSlippage,
    ensoPriceImpactPercentage,
    ensoQuoteSlippage,
    ensoSlippageCalibrationKey,
    estimatedPriceImpactPercentage,
    expectedOutInAsset,
    inputToken?.symbol,
    isLoadingQuote,
    minExpectedOutInAsset,
    normalizedExpectedOut,
    normalizedMinExpectedOut,
    routeType,
    worstCaseRouteImpactPercentage,
    zapSlippage
  ])

  // Calculate worst-case route impact for warning and blocking.
  const priceImpactInfo = useMemo(() => {
    if (!isEnsoRoute) {
      return {
        percentage: 0,
        isAboveTolerance: false,
        isBlocking: false
      }
    }

    return {
      percentage: worstCaseRouteImpactPercentage,
      isAboveTolerance: worstCaseRouteImpactPercentage > zapSlippage,
      isBlocking: worstCaseRouteImpactPercentage >= ZAP_SLIPPAGE_HARD_CAP
    }
  }, [isEnsoRoute, worstCaseRouteImpactPercentage, zapSlippage])
  const unpricedEnsoDepositError =
    isEnsoRoute &&
    ensoPriceImpactPercentage === undefined &&
    depositValueInfo.hasIncompleteUsdValuation &&
    depositAmount.debouncedBn > 0n &&
    !depositAmount.isDebouncing &&
    !isPreparingEnsoQuote
      ? 'Unable to estimate zap price impact for the selected token. Use the base asset flow or swap elsewhere.'
      : null
  const effectiveDepositError = depositError || unpricedEnsoDepositError

  const {
    spenderAddress: approvalSpenderAddress,
    spenderName: approvalSpenderName,
    approvalWarning
  } = getDepositApprovalSpender({
    routeType,
    destinationToken,
    chainId: sourceChainId,
    stakingAddress: stakingDepositAddress,
    routerAddress: activeFlow.periphery.approvalSpenderAddress || activeFlow.periphery.routerAddress,
    vaultSymbol,
    stakingTokenSymbol: stakingToken?.symbol
  })
  const formattedDepositAmount = formatTAmount({ value: depositAmount.bn, decimals: inputToken?.decimals ?? 18 })
  const needsApproval = !isNativeToken && !activeFlow.periphery.isAllowanceSufficient
  const shouldDisableSetUnlimitedForAllowanceReset =
    !isNativeToken && activeFlow.periphery.allowance > 0n && requiresAllowanceResetBeforeApproval(depositToken)
  const hasSyncedDepositAmount = !depositAmount.isDebouncing && depositAmount.bn === depositAmount.debouncedBn
  const shouldBlockApprovalForAllowanceReset =
    hasSyncedDepositAmount &&
    shouldBlockDepositApprovalForAllowanceReset({
      depositToken,
      currentAllowance: activeFlow.periphery.allowance,
      requiredAmount: depositAmount.debouncedBn,
      availableBalance: inputToken?.balance.raw ?? 0n,
      needsApproval
    })
  const approvalFlowKey = useMemo(
    () =>
      [routeType, depositToken, destinationToken, sourceChainId, chainId, depositAmount.debouncedBn.toString()].join(
        ':'
      ),
    [chainId, depositAmount.debouncedBn, depositToken, destinationToken, routeType, sourceChainId]
  )
  const [completedApprovalFlowKey, setCompletedApprovalFlowKey] = useState<string | null>(null)
  const hasCompletedApprovalInActiveFlow = completedApprovalFlowKey === approvalFlowKey
  const effectiveNeedsApproval = needsApproval && !hasCompletedApprovalInActiveFlow
  const executableEnsoTx = isWaitingForProtectedEnsoQuote ? undefined : activeFlow.periphery.tx
  const safeDepositBatch = useMemo(() => {
    if (!isWalletSafe || !needsApproval) {
      return undefined
    }

    return buildSafeDepositBatch({
      routeType,
      account,
      depositToken: toAddress(depositToken),
      amount: depositAmount.debouncedBn,
      currentAllowance: activeFlow.periphery.allowance,
      chainId: routeType === 'ENSO' ? sourceChainId : chainId,
      vaultAddress,
      stakingAddress: stakingDepositAddress,
      stakingSource,
      approvalSpenderAddress: approvalWarning ? undefined : approvalSpenderAddress,
      routerAddress: activeFlow.periphery.routerAddress ? toAddress(activeFlow.periphery.routerAddress) : undefined,
      ensoTx: executableEnsoTx
        ? {
            to: toAddress(executableEnsoTx.to),
            data: executableEnsoTx.data,
            value: executableEnsoTx.value
          }
        : undefined
    })
  }, [
    account,
    activeFlow.periphery.allowance,
    activeFlow.periphery.routerAddress,
    approvalSpenderAddress,
    approvalWarning,
    chainId,
    depositAmount.debouncedBn,
    depositToken,
    isWalletSafe,
    needsApproval,
    executableEnsoTx,
    routeType,
    sourceChainId,
    stakingDepositAddress,
    stakingSource,
    vaultAddress
  ])

  const currentStep: TransactionStep | undefined = useMemo(() => {
    const { actionLabel, progressLabel, pastTenseLabel } = getDepositActionCopy(routeType)

    if (safeDepositBatch) {
      return {
        prepare: activeFlow.actions.prepareApprove,
        batch: safeDepositBatch,
        label: `Approve & ${actionLabel}`,
        confirmMessage: `Submitting approval and ${actionLabel.toLowerCase()} to your Safe`,
        successTitle: isCrossChain ? 'Transaction Submitted' : `${actionLabel} successful!`,
        successMessage: isCrossChain
          ? `Your cross-chain ${actionLabel.toLowerCase()} has been submitted.\nIt may take a few minutes to complete on the destination chain.`
          : `You have ${pastTenseLabel} ${formattedDepositAmount} ${inputToken?.symbol || ''} into ${vaultSymbol}.`,
        isEnabled:
          !isWaitingForProtectedEnsoQuote &&
          activeFlow.periphery.prepareApproveEnabled &&
          safeDepositBatch.calls.length > 0,
        completesFlow: true,
        showConfetti: true,
        notification: depositNotificationParams
      }
    }

    if (effectiveNeedsApproval) {
      return {
        prepare: activeFlow.actions.prepareApprove,
        label: 'Approve',
        confirmMessage: `Approving ${formattedDepositAmount} ${inputToken?.symbol || ''}`,
        successTitle: 'Approval successful',
        successMessage: `Approved ${formattedDepositAmount} ${inputToken?.symbol || ''}.\nReady to deposit.`,
        isEnabled: !isWaitingForProtectedEnsoQuote && activeFlow.periphery.prepareApproveEnabled,
        completesFlow: false,
        notification: approveNotificationParams
      }
    }

    if (isCrossChain) {
      return {
        prepare: activeFlow.actions.prepareDeposit,
        label: actionLabel,
        confirmMessage: `${progressLabel} ${formattedDepositAmount} ${inputToken?.symbol || ''}`,
        successTitle: 'Transaction Submitted',
        successMessage: `Your cross-chain ${actionLabel.toLowerCase()} has been submitted.\nIt may take a few minutes to complete on the destination chain.`,
        isEnabled: !isWaitingForProtectedEnsoQuote && activeFlow.periphery.prepareDepositEnabled,
        completesFlow: true,
        showConfetti: true,
        notification: depositNotificationParams
      }
    }

    return {
      prepare: activeFlow.actions.prepareDeposit,
      label: actionLabel,
      confirmMessage: `${progressLabel} ${formattedDepositAmount} ${inputToken?.symbol || ''}`,
      successTitle: `${actionLabel} successful!`,
      successMessage: `You have ${pastTenseLabel} ${formattedDepositAmount} ${inputToken?.symbol || ''} into ${vaultSymbol}.`,
      isEnabled: !isWaitingForProtectedEnsoQuote && activeFlow.periphery.prepareDepositEnabled,
      completesFlow: true,
      showConfetti: true,
      notification: depositNotificationParams
    }
  }, [
    effectiveNeedsApproval,
    activeFlow.actions.prepareApprove,
    activeFlow.actions.prepareDeposit,
    activeFlow.periphery.prepareApproveEnabled,
    activeFlow.periphery.prepareDepositEnabled,
    safeDepositBatch,
    formattedDepositAmount,
    inputToken?.symbol,
    vaultSymbol,
    routeType,
    approveNotificationParams,
    depositNotificationParams,
    isCrossChain,
    isWaitingForProtectedEnsoQuote
  ])

  const { fetchMaxQuote, isFetching: isFetchingMaxQuote } = useFetchMaxQuote({
    isNativeToken,
    account,
    balance: inputToken?.balance.raw,
    decimals: inputToken?.decimals ?? 18,
    depositToken,
    destinationToken,
    sourceChainId,
    chainId,
    slippage: zapSlippage,
    inputTokenUsdPrice: inputTokenPrice,
    assetTokenUsdPrice: assetTokenPrice,
    pricePerShare: pricePerShare || 0n,
    vaultDecimals,
    assetTokenDecimals: assetToken?.decimals ?? 18,
    vaultAddress,
    stakingAddress: stakingDepositAddress,
    stakingSource,
    onResult: setDepositInput
  })

  const depositRefreshTargets = useMemo(() => {
    const targets = [
      { address: depositToken, chainID: sourceChainId },
      { address: vaultAddress, chainID: chainId }
    ]
    if (stakingDepositAddress) {
      targets.push({ address: stakingDepositAddress, chainID: chainId })
    }
    return targets
  }, [chainId, depositToken, sourceChainId, stakingDepositAddress, vaultAddress])

  // Called by TransactionOverlay after the final tx confirms on-chain, while the
  // overlay is in "refreshing" state. We await the wallet balance refetch so the
  // success screen appears only once balances are fresh. Not called for cross-chain
  // deposits (those refresh in handleDepositSuccess after bridge completes).
  const handleDepositTransactionSuccess = useCallback(
    async (_label: string) => {
      if (isCrossChain) return
      await Promise.all([Promise.resolve(refetchVaultUserData()), refreshWalletBalances(depositRefreshTargets)])
    },
    [isCrossChain, depositRefreshTargets, refreshWalletBalances, refetchVaultUserData]
  )

  const handleDepositStepSuccess = useCallback(
    (label: string) => {
      if (label === 'Approve' || label === 'Sign Permit') {
        setCompletedApprovalFlowKey(approvalFlowKey)
      }
    },
    [approvalFlowKey]
  )

  const refetchActiveAllowance = activeFlow.periphery.refetchAllowance
  const handleApprovalOverlayDone = useCallback(async () => {
    try {
      await refetchActiveAllowance?.()
    } catch (error) {
      console.warn('[WidgetDeposit] Failed to refetch allowance after approval update', error)
    }
    setCompletedApprovalFlowKey(null)
    setApprovalRouteRefreshKey((current) => current + 1)
  }, [refetchActiveAllowance])

  const openApprovalOverlay = useCallback(() => {
    setDisableApprovalOverlaySetUnlimited(shouldDisableSetUnlimitedForAllowanceReset)
    setShowApprovalOverlay(true)
  }, [shouldDisableSetUnlimitedForAllowanceReset])

  const openApprovalResetOverlay = useCallback(() => {
    setDisableApprovalOverlaySetUnlimited(true)
    setShowApprovalOverlay(true)
  }, [])

  const closeApprovalOverlay = useCallback(() => {
    setShowApprovalOverlay(false)
    setDisableApprovalOverlaySetUnlimited(false)
  }, [])

  const handleDepositSuccess = useCallback(() => {
    const amountToDeposit = formatUnits(depositAmount.bn, inputToken?.decimals ?? 18)
    const priceUsd = inputTokenPrice
    const valueUsd = Number(amountToDeposit) * inputTokenPrice

    trackEvent(PLAUSIBLE_EVENTS.DEPOSIT, {
      props: {
        chainID: String(chainId),
        vaultAddress,
        vaultSymbol,
        amountToDeposit,
        tokenAddress: toAddress(depositToken),
        tokenSymbol: inputToken?.symbol || '',
        priceUsd: String(priceUsd),
        valueUsd: String(valueUsd),
        isZap: String(routeType === 'ENSO'),
        action: 'deposit'
      }
    })

    setCompletedApprovalFlowKey(null)
    setDepositInput('')
    if (forceStake && routeType === 'DIRECT_STAKE') {
      setSelectedToken(assetAddress)
      setSelectedChainId(undefined)
    }
    // Cross-chain deposits: the transaction submits on source chain but funds
    // don't arrive on destination until minutes later, so there is no on-chain
    // receipt — onBeforeSuccess never fires for these. Refresh balances here
    // instead so the sent tokens are reflected after the bridge completes.
    if (isCrossChain) {
      refreshWalletBalances(depositRefreshTargets)
      refetchVaultUserData()
    }
    onDepositSuccess?.()
  }, [
    depositAmount.bn,
    inputToken?.decimals,
    inputToken?.symbol,
    inputTokenPrice,
    trackEvent,
    chainId,
    vaultAddress,
    vaultSymbol,
    depositToken,
    routeType,
    forceStake,
    assetAddress,
    setDepositInput,
    isCrossChain,
    depositRefreshTargets,
    refreshWalletBalances,
    onDepositSuccess,
    refetchVaultUserData
  ])

  const handleTokenChange = useCallback(
    (address: `0x${string}`, tokenChainId?: number) => {
      setDepositInput('')
      setSelectedToken(address)
      setSelectedChainId(tokenChainId)
      onUserTokenSelectionChange?.(address, tokenChainId ?? chainId)
      setShowTokenSelector(false)
    },
    [chainId, onUserTokenSelectionChange, setDepositInput]
  )

  const showYBoldAutoStakeWarning =
    !forceStake &&
    !isAutoStakingEnabled &&
    isAddressEqual(vaultAddress, YBOLD_VAULT_ADDRESS) &&
    Boolean(stakingDepositAddress && isAddressEqual(stakingDepositAddress, YBOLD_STAKING_ADDRESS))

  useEffect(
    () => () => {
      if (yBoldAutoStakeWarningTimeoutRef.current) {
        clearTimeout(yBoldAutoStakeWarningTimeoutRef.current)
      }
      if (yBoldAutoStakeWarningExitTimeoutRef.current) {
        clearTimeout(yBoldAutoStakeWarningExitTimeoutRef.current)
      }
    },
    []
  )

  useEffect(() => {
    if (!showYBoldAutoStakeWarning) return

    if (yBoldAutoStakeWarningTimeoutRef.current) {
      clearTimeout(yBoldAutoStakeWarningTimeoutRef.current)
      yBoldAutoStakeWarningTimeoutRef.current = null
    }
    if (yBoldAutoStakeWarningExitTimeoutRef.current) {
      clearTimeout(yBoldAutoStakeWarningExitTimeoutRef.current)
      yBoldAutoStakeWarningExitTimeoutRef.current = null
    }
    setIsYBoldAutoStakeWarningDismissing(false)
    setIsYBoldAutoStakeWarningExiting(false)
  }, [showYBoldAutoStakeWarning])

  const handleYBoldAutoStakeToggle = useCallback(() => {
    const nextIsAutoStakingEnabled = !isAutoStakingEnabled
    setIsAutoStakingEnabled(nextIsAutoStakingEnabled)

    if (nextIsAutoStakingEnabled && showYBoldAutoStakeWarning) {
      setIsYBoldAutoStakeWarningDismissing(true)
      setIsYBoldAutoStakeWarningExiting(false)
      if (yBoldAutoStakeWarningTimeoutRef.current) {
        clearTimeout(yBoldAutoStakeWarningTimeoutRef.current)
      }
      if (yBoldAutoStakeWarningExitTimeoutRef.current) {
        clearTimeout(yBoldAutoStakeWarningExitTimeoutRef.current)
      }
      yBoldAutoStakeWarningExitTimeoutRef.current = setTimeout(() => {
        setIsYBoldAutoStakeWarningExiting(true)
        yBoldAutoStakeWarningExitTimeoutRef.current = null
        yBoldAutoStakeWarningTimeoutRef.current = setTimeout(() => {
          setIsYBoldAutoStakeWarningDismissing(false)
          setIsYBoldAutoStakeWarningExiting(false)
          yBoldAutoStakeWarningTimeoutRef.current = null
        }, 300)
      }, 1000)
      return
    }

    if (yBoldAutoStakeWarningTimeoutRef.current) {
      clearTimeout(yBoldAutoStakeWarningTimeoutRef.current)
      yBoldAutoStakeWarningTimeoutRef.current = null
    }
    if (yBoldAutoStakeWarningExitTimeoutRef.current) {
      clearTimeout(yBoldAutoStakeWarningExitTimeoutRef.current)
      yBoldAutoStakeWarningExitTimeoutRef.current = null
    }
    setIsYBoldAutoStakeWarningDismissing(false)
    setIsYBoldAutoStakeWarningExiting(false)
  }, [isAutoStakingEnabled, setIsAutoStakingEnabled, showYBoldAutoStakeWarning])

  if (isLoadingVaultData && !showTransactionOverlay) {
    return (
      <WidgetLoadingSkeleton
        title={titleOverride ?? 'Deposit'}
        actions={headerActions}
        disableBorderRadius={disableBorderRadius}
      />
    )
  }

  // ============================================================================
  // Render
  // ============================================================================
  const isSettingsVisible = !!account && !!isSettingsOpen
  const onAllowanceClick =
    !isNativeToken && activeFlow.periphery.allowance > 0n
      ? (): void => {
          setDepositInput(formatUnits(activeFlow.periphery.allowance, inputToken?.decimals ?? 18))
        }
      : undefined
  const displayedExpectedVaultShares = isEnsoRoute
    ? activeFlow.periphery.minExpectedOut
    : activeFlow.periphery.expectedOut
  const displayedVaultShareValueInAsset = isEnsoRoute
    ? depositValueInfo.minVaultShareValueInAsset
    : depositValueInfo.vaultShareValueInAsset
  const displayedVaultShareValueUsdRaw = isEnsoRoute
    ? depositValueInfo.minVaultShareValueUsdRaw
    : depositValueInfo.vaultShareValueUsdRaw
  const displayedPriceImpactPercentage = isEnsoRoute
    ? worstCaseRouteImpactPercentage
    : depositValueInfo.priceImpactPercentage
  const displayedShouldHighlightPriceImpact =
    isEnsoRoute && (priceImpactInfo.isAboveTolerance || priceImpactInfo.isBlocking)
  const displayedConvertedVaultShares = isEnsoRoute ? normalizedMinExpectedOut : normalizedExpectedOut
  const shouldShowShareConversion =
    willReceiveStakedShares && displayedExpectedVaultShares !== displayedConvertedVaultShares

  const detailsSection = detailsContent ? (
    detailsContent
  ) : hideDetails ? null : (
    <DepositDetails
      depositAmountBn={depositAmount.bn}
      inputTokenSymbol={inputToken?.symbol}
      inputTokenDecimals={inputToken?.decimals ?? 18}
      inputTokenUsdPrice={inputTokenPrice}
      routeType={routeType}
      isSwap={ensoRouteHasSwap}
      usesMinExpectedOut={isEnsoRoute}
      isLoadingQuote={isPreparingEnsoQuote}
      isQuoteStale={depositAmount.isDebouncing || depositAmount.bn !== depositAmount.debouncedBn}
      expectedOutInAsset={expectedOutInAsset}
      minExpectedOutInAsset={minExpectedOutInAsset}
      assetTokenSymbol={assetToken?.symbol}
      assetTokenDecimals={assetToken?.decimals ?? 18}
      expectedVaultShares={displayedExpectedVaultShares}
      vaultDecimals={vaultDecimals}
      sharesDisplayDecimals={sharesDecimals}
      pricePerShare={pricePerShare || 0n}
      assetUsdPrice={assetTokenPrice}
      vaultShareValueInAsset={displayedVaultShareValueInAsset}
      vaultShareValueUsdRaw={displayedVaultShareValueUsdRaw}
      expectedPriceImpactPercentage={estimatedPriceImpactPercentage}
      priceImpactPercentage={displayedPriceImpactPercentage}
      shouldHighlightPriceImpact={displayedShouldHighlightPriceImpact}
      willReceiveStakedShares={willReceiveStakedShares}
      vaultSharesLabel={vaultSharesLabel}
      onShowVaultSharesModal={() => setShowVaultSharesModal(true)}
      onShowVaultShareValueModal={() => setShowVaultShareValueModal(true)}
      estimatedAnnualReturn={estimatedAnnualReturn}
      onShowAnnualReturnModal={() => setShowAnnualReturnModal(true)}
      allowance={!isNativeToken ? activeFlow.periphery.allowance : undefined}
      allowanceTokenDecimals={!isNativeToken ? (inputToken?.decimals ?? 18) : undefined}
      allowanceTokenSymbol={!isNativeToken ? inputToken?.symbol : undefined}
      approvalSpenderName={approvalSpenderName}
      onAllowanceClick={onAllowanceClick}
      onShowApprovalOverlay={!isNativeToken && approvalSpenderAddress ? openApprovalOverlay : undefined}
    />
  )

  const priceImpactWarning = (
    <PriceImpactWarning
      percentage={priceImpactInfo.percentage}
      userTolerancePercentage={zapSlippage}
      isBlocking={priceImpactInfo.isBlocking}
      isLoading={isPreparingEnsoQuote}
      isDebouncing={depositAmount.isDebouncing}
      isAmountSynced={depositAmount.bn === depositAmount.debouncedBn}
      hasAmount={depositAmount.bn > 0n}
    />
  )
  const approvalResetWarning = shouldBlockApprovalForAllowanceReset ? (
    <ApprovalResetWarning
      tokenSymbol={inputToken?.symbol}
      spenderName={approvalSpenderName}
      onManageApproval={openApprovalResetOverlay}
    />
  ) : null
  const shouldRenderYBoldAutoStakeWarning = showYBoldAutoStakeWarning || isYBoldAutoStakeWarningDismissing
  const isYBoldAutoStakeToggleOn = isAutoStakingEnabled || isYBoldAutoStakeWarningDismissing
  const yBoldAutoStakeWarning = shouldRenderYBoldAutoStakeWarning ? (
    <div
      className={cl(
        'rounded-lg border border-primary/80 bg-surface-tertiary/80 px-3 py-2 text-sm text-text-primary transition-all duration-300 ease-out',
        isYBoldAutoStakeWarningExiting
          ? 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'
          : 'translate-y-0 scale-100 opacity-100'
      )}
    >
      <div className="flex items-center justify-between gap-5">
        <p className="text-sm leading-5 text-text-primary">
          <span className="font-semibold">Automatic staking off.</span>
          <span className="block">If this is not intentional, turn it on by clicking the toggle to the right.</span>
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={isYBoldAutoStakeToggleOn}
          aria-label="Toggle automatic staking"
          disabled={isYBoldAutoStakeWarningDismissing}
          onClick={handleYBoldAutoStakeToggle}
          className={cl(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
            isYBoldAutoStakeToggleOn
              ? 'border-blue-600 bg-blue-600'
              : 'border-text-primary/30 bg-text-primary/15 shadow-inner hover:bg-text-primary/20'
          )}
        >
          <span
            className={cl(
              'inline-block h-4 w-4 rounded-full border bg-surface shadow-sm transition-transform',
              isYBoldAutoStakeToggleOn
                ? 'border-border'
                : 'border-text-primary/30 [html[data-theme=blue-dark]_&]:bg-white [html[data-theme=dark]_&]:bg-white [html[data-theme=midnight]_&]:bg-white [html[data-theme=soft-dark]_&]:bg-white',
              isYBoldAutoStakeToggleOn ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>
    </div>
  ) : null

  const showActionRow = !hideActionButton || !!onOpenSettings
  const showSettingsButton = !!account && !!onOpenSettings
  const depositButtonLabel = getDepositButtonLabel(
    isPreparingEnsoQuote,
    effectiveNeedsApproval,
    routeType,
    actionLabelOverride
  )
  const isCurrentStepWaitingForPrepare = Boolean(
    currentStep &&
      currentStep.isEnabled !== false &&
      !currentStep.batch &&
      !currentStep.isPermit &&
      !currentStep.prepare.isSuccess &&
      !currentStep.prepare.isError
  )
  const isDepositButtonBusy =
    !shouldBlockApprovalForAllowanceReset && (isPreparingEnsoQuote || isCurrentStepWaitingForPrepare)
  const isDepositButtonDisabled =
    !!effectiveDepositError ||
    depositAmount.bn === 0n ||
    isPreparingEnsoQuote ||
    depositAmount.isDebouncing ||
    shouldBlockApprovalForAllowanceReset ||
    isCurrentStepWaitingForPrepare ||
    (effectiveNeedsApproval && !activeFlow.periphery.prepareApproveEnabled) ||
    (!effectiveNeedsApproval && !activeFlow.periphery.prepareDepositEnabled) ||
    (isEnsoRoute && (priceImpactInfo.isBlocking || priceImpactInfo.isAboveTolerance))

  const actionRow = showActionRow ? (
    <div className="flex flex-col gap-3">
      {approvalResetWarning}
      {priceImpactWarning}
      {contentAboveButton}
      {yBoldAutoStakeWarning}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          {hideActionButton ? null : !account ? (
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
              variant={isDepositButtonBusy ? 'busy' : 'filled'}
              isBusy={isDepositButtonBusy}
              disabled={isDepositButtonDisabled}
              className="w-full"
              classNameOverride="yearn--button--nextgen w-full"
            >
              {depositButtonLabel}
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
  ) : null

  return (
    <div
      className={cl('flex flex-col relative h-full', {
        'border border-border': !hideContainerBorder,
        'rounded-lg': !hideContainerBorder && !disableBorderRadius
      })}
      data-tour="vault-detail-deposit-widget"
    >
      <WidgetHeader title={titleOverride ?? 'Deposit'} actions={headerActions} />
      <div className="flex flex-col flex-1 p-6 pt-2 gap-3">
        {/* Amount Section */}
        <InputTokenAmount
          input={depositInput}
          title="Amount"
          placeholder="0.00"
          balance={inputToken?.balance.raw}
          decimals={inputToken?.decimals}
          symbol={inputToken?.symbol}
          disabled={isFetchingMaxQuote}
          isMaxButtonLoading={isFetchingMaxQuote}
          onMaxClick={isNativeToken && routeType === 'ENSO' ? fetchMaxQuote : undefined}
          errorMessage={effectiveDepositError || undefined}
          showTokenSelector={ensoEnabled}
          inputTokenUsdPrice={inputTokenPrice}
          outputTokenUsdPrice={outputTokenPrice}
          tokenAddress={inputTokenLogoAddress}
          tokenChainId={inputTokenLogoChainID}
          tokenLogoURI={inputTokenLogoURI}
          onTokenSelectorClick={openTokenSelector}
        />

        {contentBelowInput}

        {shouldCollapseDetails ? (
          <>
            <button
              type="button"
              onClick={() => setIsDetailsPanelOpen(true)}
              aria-expanded={isDetailsPanelOpen}
              className="flex w-full items-center justify-between gap-3 border border-border rounded-lg bg-surface-secondary px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface"
            >
              <span>Your Transaction Details</span>
              <IconChevron className="size-4 text-text-secondary" direction="right" />
            </button>
            {actionRow}
          </>
        ) : (
          <>
            {/* Details Section */}
            {detailsSection}

            {/* Action Button */}
            {actionRow}
          </>
        )}
      </div>

      {shouldCollapseDetails && isDetailsPanelOpen ? (
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
          <div className="border-t border-border px-6 py-6">{actionRow}</div>
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
        isLastStep={!effectiveNeedsApproval}
        deferOnAllCompleteUntilClose={deferSuccessEffectsUntilClose}
        deferOnAllCompleteUntilConfettiEnd={deferSuccessEffectsUntilConfettiEnd}
        autoContinueToNextStep
        autoContinueStepLabels={['Approve', 'Sign Permit']}
        onStepSuccess={handleDepositStepSuccess}
        onBeforeSuccess={handleDepositTransactionSuccess}
        onAllComplete={handleDepositSuccess}
      />

      {/* Modals */}
      <VaultSharesOverlay
        isOpen={showVaultSharesModal}
        onClose={() => setShowVaultSharesModal(false)}
        depositTokenSymbol={inputToken?.symbol || ''}
        vaultAssetSymbol={assetToken?.symbol || ''}
        vaultSymbol={vaultSymbol}
        stakingTokenSymbol={stakingToken?.symbol}
        expectedShares={
          displayedExpectedVaultShares > 0n ? formatWidgetValue(displayedExpectedVaultShares, sharesDecimals) : '0'
        }
        stakingAddress={stakingDepositAddress}
        isAutoStakingEnabled={isAutoStakingEnabled}
        isZap={routeType === 'ENSO' && selectedToken !== assetAddress}
        routeType={routeType}
      />

      <AnnualReturnOverlay
        isOpen={showAnnualReturnModal}
        onClose={() => setShowAnnualReturnModal(false)}
        depositAmount={formatWidgetValue(depositAmount.debouncedBn, inputToken?.decimals ?? 18)}
        tokenSymbol={inputToken?.symbol}
        estimatedReturn={formatWidgetValue(estimatedAnnualReturn)}
        currentAPR={vaultAPR}
      />

      <VaultShareValueOverlay
        isOpen={showVaultShareValueModal}
        onClose={() => setShowVaultShareValueModal(false)}
        sharesAmount={formatWidgetValue(displayedExpectedVaultShares, sharesDecimals)}
        sharesLabel={receivedSharesLabel}
        shareValue={formatWidgetValue(displayedVaultShareValueInAsset, assetToken?.decimals ?? 18)}
        assetSymbol={assetToken?.symbol || ''}
        usdValue={formatWidgetValue(displayedVaultShareValueUsdRaw)}
        showShareConversion={shouldShowShareConversion}
        convertedVaultSharesAmount={
          shouldShowShareConversion ? formatWidgetValue(displayedConvertedVaultShares, vaultDecimals) : undefined
        }
      />

      {approvalSpenderAddress ? (
        <ApprovalOverlay
          isOpen={showApprovalOverlay}
          onClose={closeApprovalOverlay}
          onDone={handleApprovalOverlayDone}
          disableSetUnlimited={disableApprovalOverlaySetUnlimited}
          tokenSymbol={inputToken?.symbol || ''}
          tokenAddress={toAddress(depositToken)}
          tokenDecimals={inputToken?.decimals ?? 18}
          spenderAddress={approvalSpenderAddress}
          spenderName={approvalSpenderName || 'Vault'}
          chainId={sourceChainId}
          currentAllowance={formatWidgetAllowance(activeFlow.periphery.allowance, inputToken?.decimals ?? 18) || '0'}
          approvalWarning={approvalWarning}
        />
      ) : null}

      {showTokenSelector ? (
        <TokenSelectorOverlay
          onClose={() => setShowTokenSelector(false)}
          onChange={handleTokenChange}
          mode={'deposit'}
          chainId={sourceChainId}
          value={selectedToken}
          priorityTokens={{ [chainId]: [assetAddress] }}
          topTokens={tokenSelectorTopTokens}
          excludeTokens={tokenSelectorExcludedTokens}
          extraTokens={tokenSelectorExtraTokens}
          assetAddress={assetAddress}
          assetChainId={chainId}
          vaultAddress={vaultAddress}
          stakingAddress={stakingAddress}
        />
      ) : null}
    </div>
  )
}
