import { Button } from '@lib/components/Button'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import type { TNormalizedBN } from '@lib/types'
import type { TCreateNotificationParams } from '@lib/types/notifications'
import { cl, formatAmount, formatTAmount, toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { TxButton } from '@nextgen/components/TxButton'
import { useDirectUnstake } from '@nextgen/hooks/actions/useDirectUnstake'
import { useDirectWithdraw } from '@nextgen/hooks/actions/useDirectWithdraw'
import { useEnsoWithdraw } from '@nextgen/hooks/actions/useEnsoWithdraw'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import type { UseWidgetWithdrawFlowReturn } from '@nextgen/types'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { InputTokenAmountV2 } from '../../InputTokenAmountV2'
import { SettingsPopover } from '../SettingsPopover'
import { TokenSelectorOverlay, useLoadingQuote } from '../shared'
import { SourceSelector } from './SourceSelector'
import type { WithdrawWidgetProps, WithdrawalSource } from './types'
import { useWithdrawRoute } from './useWithdrawRoute'
import { WithdrawDetails } from './WithdrawDetails'
import { WithdrawDetailsModal } from './WithdrawDetailsModal'

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

  // Local state
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showWithdrawDetailsModal, setShowWithdrawDetailsModal] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [withdrawalSource, setWithdrawalSource] = useState<WithdrawalSource>(stakingAddress ? null : 'vault')

  // Fetch priority tokens (asset, vault, and optionally staking)
  const priorityTokenAddresses = useMemo(() => {
    const addresses: (Address | undefined)[] = [assetAddress, vaultAddress]
    if (stakingAddress) {
      addresses.push(stakingAddress)
    }
    return addresses
  }, [assetAddress, vaultAddress, stakingAddress])

  const {
    tokens: priorityTokens,
    isLoading: isLoadingPriorityTokens,
    refetch: refetchPriorityTokens
  } = useTokens(priorityTokenAddresses, chainId, account)

  // Extract priority tokens
  const [assetToken, vault, stakingToken] = priorityTokens

  // Fetch pricePerShare to convert vault shares to underlying
  const { data: pricePerShare } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'pricePerShare',
    chainId
  })

  // Fetch staking contract pricePerShare if withdrawing from staking
  const { data: stakingPricePerShare } = useReadContract({
    address: stakingAddress,
    abi: vaultAbi,
    functionName: 'pricePerShare',
    chainId,
    query: { enabled: !!stakingAddress && withdrawalSource === 'staking' }
  })

  // Determine which token to use for withdrawals
  const withdrawToken = selectedToken || assetAddress
  const destinationChainId = selectedChainId || chainId

  // Get output token from wallet context
  const outputToken = useMemo(() => {
    if (destinationChainId === chainId && withdrawToken === assetAddress) {
      return assetToken
    }
    return getToken({ address: withdrawToken, chainID: destinationChainId })
  }, [getToken, withdrawToken, destinationChainId, chainId, assetAddress, assetToken])

  // Determine available withdrawal sources
  const hasVaultBalance = vault?.balance.raw && vault.balance.raw > 0n
  const hasStakingBalance = stakingToken?.balance.raw && stakingToken.balance.raw > 0n
  const hasBothBalances = hasVaultBalance && hasStakingBalance

  // Auto-select withdrawal source if only one is available
  useEffect(() => {
    if (!hasBothBalances && (hasVaultBalance || hasStakingBalance)) {
      if (hasVaultBalance && !hasStakingBalance) {
        setWithdrawalSource('vault')
      } else if (!hasVaultBalance && hasStakingBalance) {
        setWithdrawalSource('staking')
      }
    }
  }, [hasVaultBalance, hasStakingBalance, hasBothBalances])

  // Get the actual balance based on withdrawal source
  const totalVaultBalance: TNormalizedBN = useMemo(() => {
    if (withdrawalSource === 'vault' && vault) {
      return vault.balance
    } else if (withdrawalSource === 'staking' && stakingToken) {
      return stakingToken.balance
    }
    return zeroNormalizedBN
  }, [withdrawalSource, vault, stakingToken])

  // Convert vault balance to underlying tokens
  const totalBalanceInUnderlying: TNormalizedBN = useMemo(() => {
    if (!pricePerShare || totalVaultBalance.raw === 0n || !assetToken) {
      return zeroNormalizedBN
    }
    const vaultDecimals = vault?.decimals ?? 18
    const underlyingAmount = (totalVaultBalance.raw * (pricePerShare as bigint)) / 10n ** BigInt(vaultDecimals)
    return toNormalizedBN(underlyingAmount, assetToken.decimals ?? 18)
  }, [totalVaultBalance.raw, pricePerShare, vault?.decimals, assetToken])

  // Input handling
  const withdrawInput = useDebouncedInput(assetToken?.decimals ?? 18)
  const [withdrawAmount, , setWithdrawInput] = withdrawInput

  // Determine source token based on withdrawal source selection
  const sourceToken = useMemo(() => {
    if (withdrawalSource === 'vault') {
      return vaultAddress
    } else if (withdrawalSource === 'staking' && stakingAddress) {
      return stakingAddress
    }
    return vaultAddress
  }, [withdrawalSource, vaultAddress, stakingAddress])

  // Check if this is an unstake operation
  const isUnstake = withdrawalSource === 'staking' && toAddress(withdrawToken) === toAddress(vaultAddress)

  // Determine routing type
  const routeType = useWithdrawRoute({
    withdrawToken,
    assetAddress,
    vaultAddress,
    withdrawalSource,
    chainId,
    outputChainId: outputToken.chainID ?? chainId,
    isUnstake
  })

  // Direct withdraw hook (vault → asset)
  const directWithdraw = useDirectWithdraw({
    vaultAddress,
    assetAddress,
    amount: withdrawAmount.debouncedBn,
    pricePerShare: pricePerShare || 0n,
    account,
    chainId,
    decimals: assetToken?.decimals ?? 18,
    vaultDecimals: vault?.decimals ?? 18,
    enabled: routeType === 'DIRECT_WITHDRAW' && withdrawAmount.debouncedBn > 0n
  })

  // Direct unstake hook (staking → vault)
  const directUnstake = useDirectUnstake({
    stakingAddress,
    amount: withdrawAmount.bn,
    account,
    chainId,
    enabled: routeType === 'DIRECT_UNSTAKE' && withdrawAmount.bn > 0n
  })

  // Calculate required vault shares based on desired output amount
  const requiredShares = useMemo(() => {
    if (!withdrawAmount.debouncedBn || withdrawAmount.debouncedBn === 0n) return 0n

    if (isUnstake) {
      return (
        (withdrawAmount.debouncedBn * 10n ** BigInt(stakingToken?.decimals ?? 18)) / (stakingPricePerShare as bigint)
      )
    }

    if (pricePerShare) {
      const vaultDecimals = vault?.decimals ?? 18
      return (withdrawAmount.debouncedBn * 10n ** BigInt(vaultDecimals ?? 18)) / (pricePerShare as bigint)
    }

    return 0n
  }, [
    withdrawAmount.debouncedBn,
    isUnstake,
    pricePerShare,
    stakingToken?.decimals,
    stakingPricePerShare,
    vault?.decimals
  ])

  // Withdrawal flow using Enso
  const ensoFlow = useEnsoWithdraw({
    vaultAddress: sourceToken,
    withdrawToken,
    amount: requiredShares,
    account,
    receiver: account,
    chainId,
    destinationChainId,
    decimalsOut: outputToken?.decimals ?? 18,
    enabled:
      routeType === 'ENSO' &&
      !!withdrawToken &&
      !withdrawAmount.isDebouncing &&
      requiredShares > 0n &&
      withdrawAmount.bn > 0n,
    slippage: zapSlippage * 100
  })

  // Select active flow based on routing type
  const activeFlow = useMemo((): UseWidgetWithdrawFlowReturn => {
    if (routeType === 'DIRECT_WITHDRAW') return directWithdraw
    if (routeType === 'DIRECT_UNSTAKE') return directUnstake
    return ensoFlow
  }, [routeType, directWithdraw, directUnstake, ensoFlow])

  // Combined loading state
  const isLoadingQuote = useLoadingQuote(withdrawAmount.isDebouncing, activeFlow.periphery.isLoadingRoute)

  // Error handling
  const withdrawError = useMemo(() => {
    if (hasBothBalances && !withdrawalSource) {
      return 'Please select withdrawal source'
    }
    if (withdrawAmount.bn === 0n) return null

    if (requiredShares > totalVaultBalance.raw) {
      return 'Insufficient balance'
    }

    if (routeType === 'ENSO') {
      if (
        activeFlow.periphery.error &&
        !activeFlow.periphery.isLoadingRoute &&
        withdrawAmount.debouncedBn > 0n &&
        !withdrawAmount.isDebouncing
      ) {
        return 'Unable to find route'
      }
    }

    return null
  }, [
    withdrawAmount.bn,
    withdrawAmount.debouncedBn,
    withdrawAmount.isDebouncing,
    totalVaultBalance,
    routeType,
    requiredShares,
    activeFlow.periphery.error,
    activeFlow.periphery.isLoadingRoute,
    hasBothBalances,
    withdrawalSource
  ])

  // Notification parameters for approve transaction
  const approveNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !outputToken || !account || routeType !== 'ENSO') return undefined

    const spenderAddress = activeFlow.periphery.routerAddress || withdrawToken
    const spenderName = activeFlow.periphery.routerAddress ? 'Enso Router' : outputToken.symbol || ''

    return {
      type: 'approve',
      amount: formatTAmount({ value: vault.balance.raw, decimals: vault.decimals ?? 18 }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: vault.symbol || '',
      fromChainId: chainId,
      toAddress: toAddress(spenderAddress),
      toSymbol: spenderName
    }
  }, [vault, outputToken, account, routeType, activeFlow.periphery.routerAddress, sourceToken, chainId, withdrawToken])

  // Notification parameters for withdraw transaction
  const withdrawNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !outputToken || !account || withdrawAmount.bn === 0n) return undefined

    let notificationType: 'withdraw' | 'zap' | 'crosschain zap' | 'unstake' = 'withdraw'
    if (routeType === 'ENSO') {
      notificationType = activeFlow.periphery.isCrossChain ? 'crosschain zap' : 'zap'
    } else if (routeType === 'DIRECT_UNSTAKE') {
      notificationType = 'unstake'
    }

    const sourceTokenSymbol =
      withdrawalSource === 'staking' && stakingToken ? stakingToken.symbol || vault.symbol || '' : vault.symbol || ''

    return {
      type: notificationType,
      amount: formatTAmount({ value: requiredShares, decimals: vault.decimals ?? 18 }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: sourceTokenSymbol,
      fromChainId: chainId,
      toAddress: toAddress(withdrawToken),
      toSymbol: outputToken.symbol || '',
      toChainId: activeFlow.periphery.isCrossChain ? destinationChainId : undefined
    }
  }, [
    vault,
    outputToken,
    account,
    withdrawAmount.bn,
    routeType,
    activeFlow.periphery.isCrossChain,
    requiredShares,
    sourceToken,
    chainId,
    withdrawToken,
    destinationChainId,
    stakingToken,
    withdrawalSource
  ])

  // Success handler
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
    refetchPriorityTokens()
    onWithdrawSuccess?.()
  }, [
    setWithdrawInput,
    withdrawToken,
    destinationChainId,
    vaultAddress,
    chainId,
    stakingAddress,
    refreshWalletBalances,
    refetchPriorityTokens,
    onWithdrawSuccess
  ])

  // Computed values for UI
  const actionLabel = useMemo(() => {
    if (isUnstake) return 'You will unstake'
    if (withdrawalSource === 'staking') return 'You will unstake and redeem'
    return 'You will redeem'
  }, [isUnstake, withdrawalSource])

  const transactionName = useMemo(() => {
    if (routeType === 'DIRECT_WITHDRAW') return 'Withdraw'
    if (routeType === 'DIRECT_UNSTAKE') return 'Unstake'
    if (activeFlow.periphery.isLoadingRoute) return 'Finding route...'
    return 'Withdraw'
  }, [routeType, activeFlow.periphery.isLoadingRoute])

  const showApprove = routeType === 'ENSO'

  const assetTokenPrice = useMemo(() => {
    if (!assetToken?.address || !assetToken?.chainID) return 0
    return getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
  }, [assetToken?.address, assetToken?.chainID, getPrice])

  const outputTokenPrice = useMemo(() => {
    if (!outputToken?.address || !outputToken?.chainID) return 0
    return getPrice({ address: toAddress(outputToken.address), chainID: outputToken.chainID }).normalized
  }, [outputToken?.address, outputToken?.chainID, getPrice])

  // Loading state
  if (isLoadingPriorityTokens) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col relative group/widget">
      {/* Settings Popover */}
      <div className="flex justify-end px-1 py-1 h-6 opacity-0 group-hover/widget:opacity-100 transition-opacity duration-200">
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
          <InputTokenAmountV2
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
            onInputChange={(value) => {
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
            zapToken={
              withdrawToken !== assetAddress
                ? {
                    symbol: outputToken?.symbol || 'Select Token',
                    address: outputToken?.address || '',
                    chainId: outputToken?.chainID || chainId,
                    expectedAmount:
                      activeFlow.periphery.expectedOut && activeFlow.periphery.expectedOut > 0n
                        ? formatAmount(
                            Number(formatUnits(activeFlow.periphery.expectedOut, outputToken?.decimals ?? 18)),
                            6,
                            6
                          )
                        : '0',
                    isLoading: isLoadingQuote
                  }
                : undefined
            }
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
        isLoadingQuote={isLoadingQuote}
        expectedOut={activeFlow.periphery.expectedOut}
        outputDecimals={outputToken?.decimals ?? 18}
        outputSymbol={outputToken?.symbol}
        showSwapRow={withdrawToken !== assetAddress && !isUnstake}
        withdrawAmountSimple={withdrawAmount.formValue}
        assetSymbol={assetToken?.symbol}
        routeType={routeType}
        onShowDetailsModal={() => setShowWithdrawDetailsModal(true)}
      />

      {/* Action Buttons */}
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
          <div className="flex gap-2 w-full">
            {showApprove && activeFlow.actions.prepareApprove && (
              <TxButton
                prepareWrite={activeFlow.actions.prepareApprove}
                transactionName="Approve"
                disabled={!activeFlow.periphery.prepareApproveEnabled || !!withdrawError || isLoadingQuote}
                loading={isLoadingQuote}
                className="w-full"
                notification={approveNotificationParams}
              />
            )}
            <TxButton
              prepareWrite={activeFlow.actions.prepareWithdraw}
              transactionName={transactionName}
              disabled={!activeFlow.periphery.prepareWithdrawEnabled || !!withdrawError}
              loading={isLoadingQuote}
              onSuccess={handleWithdrawSuccess}
              className="w-full"
              notification={withdrawNotificationParams}
            />
          </div>
        )}
      </div>

      {/* Withdraw Details Modal */}
      <WithdrawDetailsModal
        isOpen={showWithdrawDetailsModal}
        onClose={() => setShowWithdrawDetailsModal(false)}
        vaultSymbol={vaultSymbol}
        withdrawAmount={
          requiredShares > 0n ? formatTAmount({ value: requiredShares, decimals: vault?.decimals ?? 18 }) : '0'
        }
        stakingAddress={stakingAddress}
        withdrawalSource={withdrawalSource}
        stakingTokenSymbol={stakingToken?.symbol}
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
        }}
        chainId={chainId}
        value={selectedToken}
        excludeTokens={stakingAddress ? [stakingAddress] : undefined}
      />
    </div>
  )
}

// Re-export types
export * from './types'
