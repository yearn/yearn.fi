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
import { cl, formatAmount, formatTAmount, toAddress, toNormalizedBN, zeroNormalizedBN } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'
import { SettingsPanel } from '../SettingsPanel'
import { TokenSelectorOverlay } from '../shared/TokenSelectorOverlay'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { getPriorityTokens } from './constants'
import { SourceSelector } from './SourceSelector'
import type { WithdrawalSource, WithdrawWidgetProps } from './types'
import { useWithdrawError } from './useWithdrawError'
import { useWithdrawFlow } from './useWithdrawFlow'
import { useWithdrawNotifications } from './useWithdrawNotifications'
import { WithdrawDetails } from './WithdrawDetails'
import { WithdrawDetailsOverlay } from './WithdrawDetailsOverlay'

export const WidgetWithdraw: FC<
  WithdrawWidgetProps & { hideSettings?: boolean; disableBorderRadius?: boolean; collapseDetails?: boolean }
> = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  vaultSymbol,
  vaultVersion,
  vaultUserData,
  handleWithdrawSuccess: onWithdrawSuccess,
  onOpenSettings,
  isSettingsOpen,
  disableBorderRadius,
  collapseDetails
}) => {
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const { zapSlippage, getPrice } = useYearn()
  const trackEvent = usePlausible()
  const ensoEnabled = useEnsoEnabled()

  const [selectedToken, setSelectedToken] = useState<`0x${string}` | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showWithdrawDetailsModal, setShowWithdrawDetailsModal] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [withdrawalSource, setWithdrawalSource] = useState<WithdrawalSource>(stakingAddress ? null : 'vault')
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)

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
  const withdrawToken = selectedToken || assetAddress
  const destinationChainId = selectedChainId || chainId

  const outputToken = useMemo(() => {
    if (destinationChainId === chainId && withdrawToken === assetAddress) {
      return assetToken
    }
    return getToken({ address: withdrawToken, chainID: destinationChainId })
  }, [getToken, withdrawToken, destinationChainId, chainId, assetAddress, assetToken])

  const hasVaultBalance = (vault?.balance.raw ?? 0n) > 0n
  const hasStakingBalance = (stakingToken?.balance.raw ?? 0n) > 0n
  const hasBothBalances = hasVaultBalance && hasStakingBalance

  useEffect(() => {
    if (!hasBothBalances && (hasVaultBalance || hasStakingBalance)) {
      if (hasVaultBalance && !hasStakingBalance) {
        setWithdrawalSource('vault')
      } else if (!hasVaultBalance && hasStakingBalance) {
        setWithdrawalSource('staking')
      }
    }
  }, [hasVaultBalance, hasStakingBalance, hasBothBalances])

  useEffect(() => {
    if (!collapseDetails && isDetailsPanelOpen) {
      setIsDetailsPanelOpen(false)
    }
  }, [collapseDetails, isDetailsPanelOpen])

  const totalVaultBalance: TNormalizedBN =
    withdrawalSource === 'vault' && vault
      ? vault.balance
      : withdrawalSource === 'staking' && stakingToken
        ? stakingToken.balance
        : zeroNormalizedBN

  const sourceToken =
    withdrawalSource === 'vault'
      ? vaultAddress
      : withdrawalSource === 'staking' && stakingAddress
        ? stakingAddress
        : vaultAddress

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
  const usesErc4626 = Boolean(vaultVersion?.startsWith('3') || vaultVersion?.startsWith('~3'))

  const isMaxWithdraw = useMemo(() => {
    return (
      withdrawAmount.bn > 0n && totalBalanceInUnderlying.raw > 0n && withdrawAmount.bn === totalBalanceInUnderlying.raw
    )
  }, [withdrawAmount.bn, totalBalanceInUnderlying.raw])

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

  const actionLabel = isUnstake
    ? 'You will unstake'
    : withdrawalSource === 'staking'
      ? 'You will unstake and redeem'
      : 'You will redeem'

  const transactionName =
    routeType === 'DIRECT_WITHDRAW'
      ? 'Withdraw'
      : routeType === 'DIRECT_UNSTAKE'
        ? 'Unstake'
        : activeFlow.periphery.isLoadingRoute
          ? 'Fetching quote'
          : 'Withdraw'

  const showApprove = routeType === 'ENSO'

  const assetTokenPrice =
    assetToken?.address && assetToken?.chainID
      ? getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
      : 0

  const outputTokenPrice =
    outputToken?.address && outputToken?.chainID
      ? getPrice({ address: toAddress(outputToken.address), chainID: outputToken.chainID }).normalized
      : 0

  const zapToken = useMemo(() => {
    if (withdrawToken === assetAddress) return undefined

    const getExpectedAmount = () => {
      if (isUnstake) {
        return requiredShares > 0n
          ? formatAmount(Number(formatUnits(requiredShares, vault?.decimals ?? 18)), 6, 6)
          : '0'
      }
      return activeFlow.periphery.expectedOut && activeFlow.periphery.expectedOut > 0n
        ? formatAmount(Number(formatUnits(activeFlow.periphery.expectedOut, outputToken?.decimals ?? 18)), 6, 6)
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
    withdrawToken,
    assetAddress,
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
  const needsApproval = showApprove && !activeFlow.periphery.isAllowanceSufficient

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

    const withdrawLabel = routeType === 'DIRECT_UNSTAKE' ? 'Unstake' : 'Withdraw'

    // Cross-chain transactions show different success messages
    if (isCrossChain) {
      return {
        prepare: activeFlow.actions.prepareWithdraw,
        label: withdrawLabel,
        confirmMessage: `${routeType === 'DIRECT_UNSTAKE' ? 'Unstaking' : 'Withdrawing'} ${formattedWithdrawAmount} ${assetToken?.symbol || ''}`,
        successTitle: 'Transaction Submitted',
        successMessage: `Your cross-chain ${withdrawLabel.toLowerCase()} has been submitted.\nIt may take a few minutes to complete on the destination chain.`,
        notification: withdrawNotificationParams
      }
    }

    return {
      prepare: activeFlow.actions.prepareWithdraw,
      label: withdrawLabel,
      confirmMessage: `${routeType === 'DIRECT_UNSTAKE' ? 'Unstaking' : 'Withdrawing'} ${formattedWithdrawAmount} ${assetToken?.symbol || ''}`,
      successTitle: `${withdrawLabel} successful!`,
      successMessage: `You have ${routeType === 'DIRECT_UNSTAKE' ? 'unstaked' : 'withdrawn'} ${formattedWithdrawAmount} ${assetToken?.symbol || ''}.`,
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
    const priceUsd =
      assetToken?.address && assetToken?.chainID
        ? getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
        : 0
    const valueUsd = Number(sharesToWithdraw) * priceUsd

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
    assetToken?.address,
    assetToken?.chainID,
    outputToken?.symbol,
    getPrice,
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
      <div className="flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  // ============================================================================
  // Render
  // ============================================================================
  const isSettingsVisible = !!account && !!isSettingsOpen

  const detailsSection = (
    <WithdrawDetails
      actionLabel={actionLabel}
      requiredShares={requiredShares}
      sharesDecimals={sharesDecimals}
      isLoadingQuote={activeFlow.periphery.isLoadingRoute}
      expectedOut={activeFlow.periphery.expectedOut}
      outputDecimals={outputToken?.decimals ?? 18}
      outputSymbol={outputToken?.symbol}
      showSwapRow={withdrawToken !== assetAddress && !isUnstake}
      withdrawAmountSimple={withdrawAmount.formValue}
      assetSymbol={assetToken?.symbol}
      routeType={routeType}
      onShowDetailsModal={() => setShowWithdrawDetailsModal(true)}
      allowance={showApprove ? activeFlow.periphery.allowance : undefined}
      allowanceTokenDecimals={showApprove ? (vault?.decimals ?? 18) : undefined}
      allowanceTokenSymbol={showApprove ? vault?.symbol : undefined}
      onAllowanceClick={
        showApprove && activeFlow.periphery.allowance > 0n && pricePerShare > 0n
          ? () => {
              // Convert vault shares allowance to underlying asset amount
              const underlyingAmount =
                (activeFlow.periphery.allowance * pricePerShare) / 10n ** BigInt(vault?.decimals ?? 18)
              setWithdrawInput(formatUnits(underlyingAmount, assetToken?.decimals ?? 18))
            }
          : undefined
      }
    />
  )

  const actionRow = (
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
            disabled={
              !!withdrawError ||
              withdrawAmount.bn === 0n ||
              activeFlow.periphery.isLoadingRoute ||
              withdrawAmount.isDebouncing ||
              (showApprove &&
                !activeFlow.periphery.isAllowanceSufficient &&
                !activeFlow.periphery.prepareApproveEnabled) ||
              ((!showApprove || activeFlow.periphery.isAllowanceSufficient) &&
                !activeFlow.periphery.prepareWithdrawEnabled)
            }
            className="w-full"
            classNameOverride="yearn--button--nextgen w-full"
          >
            {activeFlow.periphery.isLoadingRoute
              ? 'Fetching quote'
              : showApprove && !activeFlow.periphery.isAllowanceSufficient
                ? `Approve & ${transactionName}`
                : transactionName}
          </Button>
        )}
      </div>
      {account && onOpenSettings ? (
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
  )

  return (
    <div
      className={cl('flex flex-col relative border border-border h-full', { 'rounded-lg': !disableBorderRadius })}
      data-tour="vault-detail-withdraw-widget"
    >
      <div className="flex items-center justify-between gap-3 px-6 pt-4 ">
        <h3 className="text-base font-semibold text-text-primary">Withdraw</h3>
      </div>
      <div className="flex flex-col flex-1 p-6 pt-2 gap-6">
        <div>
          {/* Withdraw From Selector */}
          {hasBothBalances && <SourceSelector value={withdrawalSource} onChange={setWithdrawalSource} />}

          {/* Amount Section */}
          <div className="flex flex-col gap-4">
            <InputTokenAmount
              input={withdrawInput}
              title="Amount"
              placeholder="0.00"
              balance={totalBalanceInUnderlying.raw}
              decimals={assetToken?.decimals ?? 18}
              symbol={assetToken?.symbol || 'tokens'}
              disabled={!!hasBothBalances && !withdrawalSource}
              errorMessage={withdrawError || undefined}
              inputTokenUsdPrice={assetTokenPrice}
              outputTokenUsdPrice={outputTokenPrice}
              tokenAddress={assetToken?.address}
              tokenChainId={assetToken?.chainID}
              showTokenSelector={ensoEnabled && withdrawToken === assetAddress}
              onTokenSelectorClick={() => setShowTokenSelector(true)}
              onInputChange={(value: bigint) => {
                if (value === totalBalanceInUnderlying.raw) {
                  const exactAmount = formatUnits(totalBalanceInUnderlying.raw, assetToken?.decimals ?? 18)
                  withdrawInput[2](exactAmount)
                }
              }}
              zapToken={zapToken}
              onRemoveZap={() => {
                setSelectedToken(assetAddress)
                setSelectedChainId(chainId)
              }}
              zapNotificationText={
                isUnstake
                  ? 'This transaction will unstake'
                  : withdrawToken !== assetAddress
                    ? '⚡ This transaction will use Enso to Zap to:'
                    : undefined
              }
            />
          </div>
        </div>

        {collapseDetails ? (
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

      {collapseDetails && isDetailsPanelOpen ? (
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
          <div className="border-t border-border px-6 py-4">{actionRow}</div>
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
        withdrawAmount={
          requiredShares > 0n
            ? formatTAmount({
                value: requiredShares,
                decimals: sharesDecimals
              })
            : '0'
        }
        expectedOutput={
          activeFlow.periphery.expectedOut > 0n
            ? formatTAmount({ value: activeFlow.periphery.expectedOut, decimals: outputToken?.decimals ?? 18 })
            : undefined
        }
        hasInputValue={withdrawAmount.bn > 0n}
        stakingAddress={stakingAddress}
        withdrawalSource={withdrawalSource}
        routeType={routeType}
        isZap={routeType === 'ENSO' && selectedToken !== assetAddress}
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
        assetAddress={assetAddress}
        vaultAddress={vaultAddress}
        stakingAddress={stakingAddress}
      />
    </div>
  )
}
