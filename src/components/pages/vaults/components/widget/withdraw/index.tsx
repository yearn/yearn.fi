import { useDebouncedInput } from '@pages/vaults/hooks/useDebouncedInput'
import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { vaultAbi } from '@shared/contracts/abi/vaultV2.abi'
import type { TNormalizedBN } from '@shared/types'
import { cl, formatAmount, formatTAmount, toAddress, toNormalizedBN, zeroNormalizedBN } from '@shared/utils'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'
import { SettingsPopover } from '../SettingsPopover'
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

export const WidgetWithdraw: FC<WithdrawWidgetProps> = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  vaultSymbol,
  handleWithdrawSuccess: onWithdrawSuccess
}) => {
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled, getPrice } = useYearn()

  // ============================================================================
  // UI State
  // ============================================================================
  const [selectedToken, setSelectedToken] = useState<`0x${string}` | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showWithdrawDetailsModal, setShowWithdrawDetailsModal] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [withdrawalSource, setWithdrawalSource] = useState<WithdrawalSource>(stakingAddress ? null : 'vault')

  // ============================================================================
  // Token Data (shared with VaultDetailsHeader via TanStack Query cache)
  // ============================================================================
  const {
    assetToken,
    vaultToken: vault,
    stakingToken,
    pricePerShare,
    isLoading: isLoadingVaultData,
    refetch: refetchVaultUserData
  } = useVaultUserData({
    vaultAddress,
    assetAddress,
    stakingAddress,
    chainId,
    account
  })

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

  // ============================================================================
  // Withdrawal Source Logic
  // ============================================================================
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

  // ============================================================================
  // Contract Reads
  // ============================================================================
  const { data: stakingPricePerShare = 1n * 10n ** BigInt(stakingToken?.decimals ?? 18) } = useReadContract({
    address: stakingAddress,
    abi: vaultAbi,
    functionName: 'pricePerShare',
    chainId,
    query: { enabled: !!stakingAddress && withdrawalSource === 'staking' }
  })

  // ============================================================================
  // Balance Conversions
  // ============================================================================
  const totalBalanceInUnderlying: TNormalizedBN = useMemo(() => {
    if (pricePerShare === 0n || totalVaultBalance.raw === 0n || !assetToken) {
      return zeroNormalizedBN
    }
    const vaultDecimals = vault?.decimals ?? 18
    const underlyingAmount = (totalVaultBalance.raw * pricePerShare) / 10n ** BigInt(vaultDecimals)
    return toNormalizedBN(underlyingAmount, assetToken.decimals ?? 18)
  }, [totalVaultBalance.raw, pricePerShare, vault?.decimals, assetToken])

  // ============================================================================
  // Input Handling
  // ============================================================================
  const withdrawInput = useDebouncedInput(assetToken?.decimals ?? 18)
  const [withdrawAmount, , setWithdrawInput] = withdrawInput

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
      const vaultDecimals = vault?.decimals ?? 18
      const numerator = withdrawAmount.bn * 10n ** BigInt(vaultDecimals)
      return (numerator + pricePerShare - 1n) / pricePerShare
    }

    return 0n
  }, [withdrawAmount.bn, isMaxWithdraw, totalVaultBalance.raw, pricePerShare, vault?.decimals])

  // ============================================================================
  // Withdraw Flow (routing, actions, periphery)
  // ============================================================================
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
    isDebouncing: withdrawAmount.isDebouncing
  })

  // ============================================================================
  // Notifications
  // ============================================================================
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

  // ============================================================================
  // Error Handling
  // ============================================================================
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

  // ============================================================================
  // Computed Values
  // ============================================================================
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

  // ============================================================================
  // Transaction Step Configuration
  // ============================================================================
  const formattedWithdrawAmount = formatTAmount({ value: withdrawAmount.bn, decimals: assetToken?.decimals ?? 18 })
  const needsApproval = showApprove && !activeFlow.periphery.isAllowanceSufficient

  const currentStep: TransactionStep | undefined = useMemo(() => {
    if (needsApproval && activeFlow.actions.prepareApprove) {
      return {
        prepare: activeFlow.actions.prepareApprove,
        label: 'Approve',
        confirmMessage: `Approving ${formattedWithdrawAmount} ${assetToken?.symbol || ''}`,
        successTitle: 'Approval successful',
        successMessage: `Approved ${formattedWithdrawAmount} ${assetToken?.symbol || ''}.\nReady to withdraw.`,
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
    assetToken?.symbol,
    routeType,
    approveNotificationParams,
    withdrawNotificationParams,
    isCrossChain
  ])

  // ============================================================================
  // Handlers
  // ============================================================================
  const handleWithdrawSuccess = useCallback(() => {
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
    setWithdrawInput,
    withdrawToken,
    destinationChainId,
    vaultAddress,
    chainId,
    stakingAddress,
    refreshWalletBalances,
    refetchVaultUserData,
    onWithdrawSuccess
  ])

  // ============================================================================
  // Loading State
  // ============================================================================
  if (isLoadingVaultData) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="flex flex-col relative group/widget">
      {/* Settings Popover */}
      <div className="flex justify-end md:opacity-0 md:group-hover/widget:opacity-100 transition-opacity duration-200 h-7">
        <SettingsPopover
          slippage={zapSlippage}
          setSlippage={setZapSlippage}
          maximizeYield={isAutoStakingEnabled}
          setMaximizeYield={setIsAutoStakingEnabled}
        />
      </div>

      {/* Withdraw From Selector */}
      {hasBothBalances && <SourceSelector value={withdrawalSource} onChange={setWithdrawalSource} />}

      {/* Amount Section */}
      <div className={cl('px-6 pb-6')}>
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
            showTokenSelector={withdrawToken === assetAddress}
            onTokenSelectorClick={() => setShowTokenSelector(true)}
            onInputChange={(value: bigint) => {
              if (value === totalBalanceInUnderlying.raw) {
                if (isUnstake) {
                  if (totalVaultBalance.raw > 0n) {
                    const amount =
                      (totalVaultBalance.raw * (stakingPricePerShare as bigint)) /
                      10n ** BigInt(stakingToken?.decimals ?? 18)
                    const exactAmount = formatUnits(amount, stakingToken?.decimals ?? 18)
                    withdrawInput[2](exactAmount)
                  }
                } else {
                  const exactAmount = formatUnits(totalBalanceInUnderlying.raw, assetToken?.decimals ?? 18)
                  withdrawInput[2](exactAmount)
                }
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

      {/* Details Section */}
      <WithdrawDetails
        actionLabel={actionLabel}
        requiredShares={requiredShares}
        sharesDecimals={isUnstake ? (stakingToken?.decimals ?? 18) : (vault?.decimals ?? 18)}
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

      {/* Action Button */}
      <div className="px-6 pt-6 pb-6">
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

      {/* Transaction Overlay */}
      <TransactionOverlay
        isOpen={showTransactionOverlay}
        onClose={() => setShowTransactionOverlay(false)}
        step={currentStep}
        isLastStep={!needsApproval}
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
                decimals: vault?.decimals ?? 18
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
      />
    </div>
  )
}
