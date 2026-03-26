import { usePlausible } from '@hooks/usePlausible'
import { InputTokenAmount } from '@pages/vaults/components/widget/InputTokenAmount'
import { useDebouncedInput } from '@pages/vaults/hooks/useDebouncedInput'
import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCross } from '@shared/icons/IconCross'
import { IconSettings } from '@shared/icons/IconSettings'
import type { TToken } from '@shared/types'
import { cl, formatTAmount, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { SettingsPanel } from '../SettingsPanel'
import { TokenSelectorOverlay } from '../shared/TokenSelectorOverlay'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { useResetEnsoSelection } from '../shared/useResetEnsoSelection'
import { formatWidgetAllowance, formatWidgetValue } from '../shared/valueDisplay'
import { WidgetHeader } from '../shared/WidgetHeader'
import { DEPOSIT_COMMON_TOKENS_BY_CHAIN } from '../withdraw/constants'
import { AnnualReturnOverlay } from './AnnualReturnOverlay'
import { ApprovalOverlay } from './ApprovalOverlay'
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
  }
  onPrefillApplied?: () => void
  hideSettings?: boolean
  disableBorderRadius?: boolean
  collapseDetails?: boolean
  detailsContent?: ReactNode
  contentBelowInput?: ReactNode
  vaultSharesLabel?: string
  hideDetails?: boolean
  hideActionButton?: boolean
  hideContainerBorder?: boolean
  headerActions?: ReactNode
  tokenSelectorExtraTokens?: TToken[]
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

function getDepositButtonLabel(isLoadingRoute: boolean, needsApproval: boolean, routeType: DepositRouteType): string {
  if (isLoadingRoute) {
    return 'Fetching quote'
  }

  const { actionLabel } = getDepositActionCopy(routeType)
  if (needsApproval) {
    return `Approve & ${actionLabel}`
  }

  return actionLabel
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
  hideSettings: _hideSettings,
  disableBorderRadius,
  collapseDetails,
  detailsContent,
  contentBelowInput,
  vaultSharesLabel,
  hideDetails = false,
  hideActionButton = false,
  hideContainerBorder = false,
  headerActions,
  tokenSelectorExtraTokens,
  deferSuccessEffectsUntilClose = false,
  deferSuccessEffectsUntilConfettiEnd = true
}: Props): ReactElement {
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const { zapSlippage, isAutoStakingEnabled, getPrice, allVaults } = useYearn()
  const trackEvent = usePlausible()
  const ensoEnabled = useEnsoEnabled({ chainId, vaultAddress })

  const [selectedToken, setSelectedToken] = useState<`0x${string}` | undefined>(prefill?.address ?? assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(prefill?.chainId)
  const [showVaultSharesModal, setShowVaultSharesModal] = useState(false)
  const [showVaultShareValueModal, setShowVaultShareValueModal] = useState(false)
  const [showAnnualReturnModal, setShowAnnualReturnModal] = useState(false)
  const [showApprovalOverlay, setShowApprovalOverlay] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)
  const appliedPrefillRef = useRef<string | null>(null)

  const {
    assetToken,
    vaultToken: vault,
    stakingToken,
    pricePerShare,
    isLoading: isLoadingVaultData,
    refetch: refetchVaultUserData
  } = vaultUserData
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
  const inputTokenLogoURI = selectedExtraToken?.logoURI ?? getTokenLogoURI(inputToken)

  const destinationToken = useMemo(() => {
    if (isAutoStakingEnabled && stakingAddress) return stakingAddress
    return vaultAddress
  }, [isAutoStakingEnabled, stakingAddress, vaultAddress])

  // ============================================================================
  // Input Handling
  // ============================================================================
  const depositInput = useDebouncedInput(inputToken?.decimals ?? 18)
  const [depositAmount, , setDepositInput] = depositInput
  const shouldCollapseDetails = Boolean(collapseDetails && !hideDetails && !hideActionButton)

  useEffect(() => {
    onAmountChange?.(depositAmount.formValue)
  }, [depositAmount.formValue, onAmountChange])

  useEffect(() => {
    onTokenSelectionChange?.(depositToken, sourceChainId)
  }, [depositToken, onTokenSelectionChange, sourceChainId])

  useEffect(() => {
    if (!prefill) return
    const key = `${prefill.address}-${prefill.chainId}-${prefill.amount}`
    if (appliedPrefillRef.current === key) return
    appliedPrefillRef.current = key

    const canApplyPrefilledToken =
      ensoEnabled || (toAddress(prefill.address) === toAddress(assetAddress) && prefill.chainId === chainId)

    setSelectedToken(canApplyPrefilledToken ? prefill.address : assetAddress)
    setSelectedChainId(canApplyPrefilledToken ? prefill.chainId : undefined)
    if (prefill.amount !== undefined) {
      setDepositInput(prefill.amount)
    }
    onPrefillApplied?.()
  }, [prefill, ensoEnabled, assetAddress, chainId, setDepositInput, onPrefillApplied])

  useResetEnsoSelection({
    ensoEnabled,
    selectedToken,
    selectedChainId,
    assetAddress,
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
    stakingAddress,
    amount: depositAmount.debouncedBn,
    currentAmount: depositAmount.bn,
    account,
    chainId,
    sourceChainId,
    destinationChainId: vault?.chainID,
    inputDecimals: inputToken?.decimals ?? 18,
    vaultDecimals: vault?.decimals ?? 18,
    slippage: zapSlippage,
    stakingSource
  })

  const isCrossChain = sourceChainId !== chainId
  const { approveNotificationParams, depositNotificationParams } = useDepositNotifications({
    inputToken,
    vault,
    stakingToken,
    depositToken,
    assetAddress,
    destinationToken,
    stakingAddress,
    account,
    sourceChainId,
    chainId,
    depositAmount: depositAmount.debouncedBn,
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
    isAutoStakingEnabled
  })

  const willReceiveStakedShares = routeType === 'DIRECT_STAKE' || (isAutoStakingEnabled && !!stakingAddress)
  const receivedSharesLabel = willReceiveStakedShares ? 'Staked shares' : (vaultSharesLabel ?? 'Vault shares')
  const sharesDecimals = willReceiveStakedShares
    ? (stakingToken?.decimals ?? vault?.decimals ?? 18)
    : (vault?.decimals ?? 18)
  const vaultDecimals = vault?.decimals ?? 18
  const normalizedExpectedOut = activeFlow.periphery.normalizedExpectedOut
  const isLoadingQuote = activeFlow.periphery.isLoadingRoute || activeFlow.periphery.isLoadingExpectedOutNormalization

  const estimatedAnnualReturn = useMemo(() => {
    if (depositAmount.debouncedBn === 0n || vaultAPR === 0) return 0
    return Number(formatUnits(depositAmount.debouncedBn, inputToken?.decimals ?? 18)) * vaultAPR
  }, [depositAmount.debouncedBn, inputToken?.decimals, vaultAPR])

  const expectedOutInAsset = useMemo(() => {
    if (normalizedExpectedOut === 0n || !pricePerShare || depositAmount.bn === 0n) return 0n
    return (normalizedExpectedOut * pricePerShare) / 10n ** BigInt(vaultDecimals)
  }, [normalizedExpectedOut, vaultDecimals, pricePerShare, depositAmount.bn])

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

  const depositValueInfo = useMemo(
    () =>
      calculateDepositValueInfo({
        depositAmountBn: depositAmount.bn,
        inputTokenDecimals: inputToken?.decimals ?? 18,
        inputTokenUsdPrice: inputTokenPrice,
        normalizedVaultShares: normalizedExpectedOut,
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
      vaultDecimals,
      pricePerShare,
      assetToken?.decimals,
      assetTokenPrice
    ]
  )

  // Calculate price impact for high slippage warning
  const priceImpactInfo = useMemo(() => {
    return {
      percentage: depositValueInfo.priceImpactPercentage,
      isHigh: depositValueInfo.isHighPriceImpact
    }
  }, [depositValueInfo.priceImpactPercentage, depositValueInfo.isHighPriceImpact])

  const priceImpactAcceptanceKey = useMemo(() => {
    return [
      depositAmount.bn.toString(),
      routeType,
      sourceChainId,
      depositToken,
      destinationToken,
      activeFlow.periphery.routerAddress ?? '',
      activeFlow.periphery.expectedOut.toString()
    ].join(':')
  }, [
    depositAmount.bn,
    routeType,
    sourceChainId,
    depositToken,
    destinationToken,
    activeFlow.periphery.routerAddress,
    activeFlow.periphery.expectedOut
  ])

  const [priceImpactAcceptanceState, setPriceImpactAcceptanceState] = useState<{
    key: string
    isAccepted: boolean
  }>({
    key: priceImpactAcceptanceKey,
    isAccepted: false
  })
  if (priceImpactAcceptanceState.key !== priceImpactAcceptanceKey) {
    setPriceImpactAcceptanceState({
      key: priceImpactAcceptanceKey,
      isAccepted: false
    })
  }
  const hasAcceptedPriceImpact = priceImpactAcceptanceState.isAccepted

  const formattedDepositAmount = formatTAmount({ value: depositAmount.bn, decimals: inputToken?.decimals ?? 18 })
  const needsApproval = !isNativeToken && !activeFlow.periphery.isAllowanceSufficient

  const currentStep: TransactionStep | undefined = useMemo(() => {
    if (needsApproval) {
      return {
        prepare: activeFlow.actions.prepareApprove,
        label: 'Approve',
        confirmMessage: `Approving ${formattedDepositAmount} ${inputToken?.symbol || ''}`,
        successTitle: 'Approval successful',
        successMessage: `Approved ${formattedDepositAmount} ${inputToken?.symbol || ''}.\nReady to deposit.`,
        completesFlow: false,
        notification: approveNotificationParams
      }
    }

    const { actionLabel, progressLabel, pastTenseLabel } = getDepositActionCopy(routeType)

    if (isCrossChain) {
      return {
        prepare: activeFlow.actions.prepareDeposit,
        label: actionLabel,
        confirmMessage: `${progressLabel} ${formattedDepositAmount} ${inputToken?.symbol || ''}`,
        successTitle: 'Transaction Submitted',
        successMessage: `Your cross-chain ${actionLabel.toLowerCase()} has been submitted.\nIt may take a few minutes to complete on the destination chain.`,
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
      completesFlow: true,
      showConfetti: true,
      notification: depositNotificationParams
    }
  }, [
    needsApproval,
    activeFlow.actions.prepareApprove,
    activeFlow.actions.prepareDeposit,
    formattedDepositAmount,
    inputToken?.symbol,
    vaultSymbol,
    routeType,
    approveNotificationParams,
    depositNotificationParams,
    isCrossChain
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
    onResult: setDepositInput
  })

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

    setDepositInput('')
    const tokensToRefresh = [
      { address: depositToken, chainID: sourceChainId },
      { address: vaultAddress, chainID: chainId }
    ]
    if (stakingAddress) {
      tokensToRefresh.push({ address: stakingAddress, chainID: chainId })
    }
    refreshWalletBalances(tokensToRefresh)
    refetchVaultUserData()
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
    setDepositInput,
    refreshWalletBalances,
    sourceChainId,
    stakingAddress,
    onDepositSuccess,
    refetchVaultUserData
  ])

  const handleTokenChange = useCallback(
    (address: `0x${string}`, tokenChainId?: number) => {
      setDepositInput('')
      setSelectedToken(address)
      setSelectedChainId(tokenChainId)
      setShowTokenSelector(false)
    },
    [setDepositInput]
  )

  if (isLoadingVaultData) {
    return (
      <div className={cl('flex flex-col border border-border relative h-full', { 'rounded-lg': !disableBorderRadius })}>
        <WidgetHeader title="Deposit" actions={headerActions} />
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
  const { spenderAddress: approvalSpenderAddress, spenderName: approvalSpenderName } = getDepositApprovalSpender({
    routeType,
    destinationToken,
    stakingAddress,
    routerAddress: activeFlow.periphery.routerAddress,
    vaultSymbol,
    stakingTokenSymbol: stakingToken?.symbol
  })
  const onAllowanceClick =
    !isNativeToken && activeFlow.periphery.allowance > 0n
      ? (): void => {
          setDepositInput(formatUnits(activeFlow.periphery.allowance, inputToken?.decimals ?? 18))
        }
      : undefined

  const detailsSection = detailsContent ? (
    detailsContent
  ) : hideDetails ? null : (
    <DepositDetails
      depositAmountBn={depositAmount.bn}
      inputTokenSymbol={inputToken?.symbol}
      inputTokenDecimals={inputToken?.decimals ?? 18}
      inputTokenUsdPrice={inputTokenPrice}
      routeType={routeType}
      isSwap={selectedToken !== assetAddress}
      isLoadingQuote={isLoadingQuote}
      isQuoteStale={depositAmount.isDebouncing || depositAmount.bn !== depositAmount.debouncedBn}
      expectedOutInAsset={expectedOutInAsset}
      assetTokenSymbol={assetToken?.symbol}
      assetTokenDecimals={assetToken?.decimals ?? 18}
      expectedVaultShares={activeFlow.periphery.expectedOut}
      vaultDecimals={vaultDecimals}
      sharesDisplayDecimals={sharesDecimals}
      pricePerShare={pricePerShare || 0n}
      assetUsdPrice={assetTokenPrice}
      vaultShareValueInAsset={depositValueInfo.vaultShareValueInAsset}
      vaultShareValueUsdRaw={depositValueInfo.vaultShareValueUsdRaw}
      priceImpactPercentage={depositValueInfo.priceImpactPercentage}
      hasHighPriceImpact={depositValueInfo.isHighPriceImpact}
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
      onShowApprovalOverlay={!isNativeToken ? () => setShowApprovalOverlay(true) : undefined}
    />
  )

  const priceImpactWarning = priceImpactInfo.isHigh &&
    !isLoadingQuote &&
    !depositAmount.isDebouncing &&
    depositAmount.bn === depositAmount.debouncedBn &&
    depositAmount.bn > 0n && (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
        <p className="text-sm text-red-500">
          Price impact is high ({priceImpactInfo.percentage.toFixed(2)}%). Consider depositing less or waiting for
          better liquidity conditions.
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasAcceptedPriceImpact}
            onChange={(e) =>
              setPriceImpactAcceptanceState({
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

  const showActionRow = !hideActionButton || !!onOpenSettings
  const depositButtonLabel = getDepositButtonLabel(isLoadingQuote, needsApproval, routeType)
  const isDepositButtonDisabled =
    !!depositError ||
    depositAmount.bn === 0n ||
    isLoadingQuote ||
    depositAmount.isDebouncing ||
    (!activeFlow.periphery.isAllowanceSufficient && !activeFlow.periphery.prepareApproveEnabled) ||
    (activeFlow.periphery.isAllowanceSufficient && !activeFlow.periphery.prepareDepositEnabled) ||
    (priceImpactInfo.isHigh && !hasAcceptedPriceImpact)
  const showSettingsButton = !!account && !!onOpenSettings

  const actionRow = showActionRow ? (
    <div className="flex flex-col gap-3">
      {priceImpactWarning}
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
              variant={activeFlow.periphery.isLoadingRoute ? 'busy' : 'filled'}
              isBusy={activeFlow.periphery.isLoadingRoute}
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
      <WidgetHeader title="Deposit" actions={headerActions} />
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
          errorMessage={depositError || undefined}
          showTokenSelector={ensoEnabled}
          inputTokenUsdPrice={inputTokenPrice}
          outputTokenUsdPrice={outputTokenPrice}
          tokenAddress={inputToken?.address}
          tokenChainId={inputToken?.chainID}
          tokenLogoURI={inputTokenLogoURI}
          onTokenSelectorClick={() => setShowTokenSelector(true)}
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
        isLastStep={!needsApproval}
        deferOnAllCompleteUntilClose={deferSuccessEffectsUntilClose}
        deferOnAllCompleteUntilConfettiEnd={deferSuccessEffectsUntilConfettiEnd}
        autoContinueToNextStep
        autoContinueStepLabels={['Approve', 'Sign Permit']}
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
          activeFlow.periphery.expectedOut > 0n
            ? formatWidgetValue(activeFlow.periphery.expectedOut, sharesDecimals)
            : '0'
        }
        stakingAddress={stakingAddress}
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
        sharesAmount={formatWidgetValue(activeFlow.periphery.expectedOut, sharesDecimals)}
        sharesLabel={receivedSharesLabel}
        shareValue={formatWidgetValue(depositValueInfo.vaultShareValueInAsset, assetToken?.decimals ?? 18)}
        assetSymbol={assetToken?.symbol || ''}
        usdValue={formatWidgetValue(depositValueInfo.vaultShareValueUsdRaw)}
        showShareConversion={willReceiveStakedShares && activeFlow.periphery.expectedOut !== normalizedExpectedOut}
        convertedVaultSharesAmount={
          willReceiveStakedShares && activeFlow.periphery.expectedOut !== normalizedExpectedOut
            ? formatWidgetValue(normalizedExpectedOut, vaultDecimals)
            : undefined
        }
      />

      <ApprovalOverlay
        isOpen={showApprovalOverlay}
        onClose={() => setShowApprovalOverlay(false)}
        tokenSymbol={inputToken?.symbol || ''}
        tokenAddress={toAddress(depositToken)}
        tokenDecimals={inputToken?.decimals ?? 18}
        spenderAddress={approvalSpenderAddress || destinationToken}
        spenderName={approvalSpenderName || 'Vault'}
        chainId={sourceChainId}
        currentAllowance={formatWidgetAllowance(activeFlow.periphery.allowance, inputToken?.decimals ?? 18) || '0'}
      />

      {/* Token Selector Overlay */}
      <TokenSelectorOverlay
        isOpen={showTokenSelector}
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
    </div>
  )
}
