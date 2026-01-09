import { Button } from '@lib/components/Button'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { vaultAbi } from '@lib/contracts/abi/vaultV2.abi'
import type { TNormalizedBN } from '@lib/types'
import { cl, formatAmount, formatTAmount, toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { TxButton } from '@vaults/components/widget/TxButton'
import { useDebouncedInput } from '@vaults/hooks/useDebouncedInput'
import { useTokens } from '@vaults/hooks/useTokens'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { InputTokenAmountV2 } from '../InputTokenAmountV2'
import { SettingsPopover } from '../SettingsPopover'
import { TokenSelectorOverlay } from '../shared'
import { SourceSelector } from './SourceSelector'
import type { WithdrawalSource, WithdrawWidgetProps } from './types'
import { useWithdrawError } from './useWithdrawError'
import { useWithdrawFlow } from './useWithdrawFlow'
import { useWithdrawNotifications } from './useWithdrawNotifications'
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

  // ============================================================================
  // UI State
  // ============================================================================
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showWithdrawDetailsModal, setShowWithdrawDetailsModal] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [withdrawalSource, setWithdrawalSource] = useState<WithdrawalSource>(stakingAddress ? null : 'vault')

  // ============================================================================
  // Token Data
  // ============================================================================
  const priorityTokenAddresses = useMemo(() => {
    const addresses: (Address | undefined)[] = [assetAddress, vaultAddress]
    if (stakingAddress) addresses.push(stakingAddress)
    return addresses
  }, [assetAddress, vaultAddress, stakingAddress])

  // Common tokens to always show in token selector (even without balance)
  const commonTokensByChain = useMemo((): Record<number, Address[]> => {
    const baseTokens: Record<number, Address[]> = {
      1: [
        // Ethereum
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' // WBTC
      ],
      10: [
        // Optimism
        '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
        '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
        '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
        '0x4200000000000000000000000000000000000006' // WETH
      ],
      137: [
        // Polygon
        '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // WMATIC
      ],
      42161: [
        // Arbitrum
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
        '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
        '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
        '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // WETH
      ],
      8453: [
        // Base
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        '0x4200000000000000000000000000000000000006', // WETH
        '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', // DAI
        '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' // cbBTC
      ],
      747474: [
        // Katana
        '0x00000000efe302beaa2b3e6e1b18d08d69a9012a', // AUSD
        '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36', // vbUSDC
        '0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62', // vbETH
        '0x62D6A123E8D19d06d68cf0d2294F9A3A0362c6b3' // vbUSDS
      ]
    }
    // Include vault shares on vault's chain if staking is available (for unstake)
    if (stakingAddress) {
      baseTokens[chainId] = [vaultAddress, ...(baseTokens[chainId] || [])]
    }
    return baseTokens
  }, [chainId, stakingAddress, vaultAddress])

  const {
    tokens: priorityTokens,
    isLoading: isLoadingPriorityTokens,
    refetch: refetchPriorityTokens
  } = useTokens(priorityTokenAddresses, chainId, account)

  const [assetToken, vault, stakingToken] = priorityTokens

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

  const totalVaultBalance: TNormalizedBN = useMemo(() => {
    if (withdrawalSource === 'vault' && vault) return vault.balance
    if (withdrawalSource === 'staking' && stakingToken) return stakingToken.balance
    return zeroNormalizedBN
  }, [withdrawalSource, vault, stakingToken])

  const sourceToken = useMemo(() => {
    if (withdrawalSource === 'vault') return vaultAddress
    if (withdrawalSource === 'staking' && stakingAddress) return stakingAddress
    return vaultAddress
  }, [withdrawalSource, vaultAddress, stakingAddress])

  const isUnstake = withdrawalSource === 'staking' && toAddress(withdrawToken) === toAddress(vaultAddress)

  // ============================================================================
  // Contract Reads
  // ============================================================================
  const { data: pricePerShare } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'pricePerShare',
    chainId
  })

  const { data: stakingPricePerShare } = useReadContract({
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
    if (!pricePerShare || totalVaultBalance.raw === 0n || !assetToken) {
      return zeroNormalizedBN
    }
    const vaultDecimals = vault?.decimals ?? 18
    const underlyingAmount = (totalVaultBalance.raw * (pricePerShare as bigint)) / 10n ** BigInt(vaultDecimals)
    console.log(totalVaultBalance.raw, underlyingAmount)
    return toNormalizedBN(underlyingAmount, assetToken.decimals ?? 18)
  }, [totalVaultBalance.raw, pricePerShare, vault?.decimals, assetToken])

  // ============================================================================
  // Input Handling
  // ============================================================================
  const withdrawInput = useDebouncedInput(assetToken?.decimals ?? 18)
  const [withdrawAmount, , setWithdrawInput] = withdrawInput

  // ============================================================================
  // Required Shares Calculation
  // ============================================================================
  const requiredShares = useMemo(() => {
    if (!withdrawAmount.bn || withdrawAmount.bn === 0n) return 0n

    if (isUnstake) {
      return (withdrawAmount.bn * 10n ** BigInt(stakingToken?.decimals ?? 18)) / (stakingPricePerShare as bigint)
    }

    if (pricePerShare) {
      const vaultDecimals = vault?.decimals ?? 18
      return (withdrawAmount.bn * 10n ** BigInt(vaultDecimals)) / (pricePerShare as bigint)
    }

    return 0n
  }, [withdrawAmount.bn, isUnstake, pricePerShare, stakingToken?.decimals, stakingPricePerShare, vault?.decimals])

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
    account,
    chainId,
    destinationChainId,
    outputChainId: outputToken.chainID ?? chainId,
    assetDecimals: assetToken?.decimals ?? 18,
    vaultDecimals: vault?.decimals ?? 18,
    outputDecimals: outputToken?.decimals ?? 18,
    pricePerShare: pricePerShare || 0n,
    slippage: zapSlippage,
    withdrawalSource,
    isUnstake,
    isDebouncing: withdrawAmount.isDebouncing
  })

  // ============================================================================
  // Loading State
  // ============================================================================
  // const isLoadingQuote = useLoadingQuote(withdrawAmount.isDebouncing, activeFlow.periphery.isLoadingRoute)

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
  // Notifications
  // ============================================================================
  const { approveNotificationParams, withdrawNotificationParams } = useWithdrawNotifications({
    vault,
    outputToken,
    stakingToken,
    sourceToken,
    withdrawToken,
    account,
    chainId,
    destinationChainId,
    withdrawAmount: withdrawAmount.bn,
    requiredShares,
    routeType,
    routerAddress: activeFlow.periphery.routerAddress,
    isCrossChain: activeFlow.periphery.isCrossChain,
    withdrawalSource
  })

  // ============================================================================
  // Computed Values
  // ============================================================================
  const actionLabel = useMemo(() => {
    if (isUnstake) return 'You will unstake'
    if (withdrawalSource === 'staking') return 'You will unstake and redeem'
    return 'You will redeem'
  }, [isUnstake, withdrawalSource])

  const transactionName = useMemo(() => {
    if (routeType === 'DIRECT_WITHDRAW') return 'Withdraw'
    if (routeType === 'DIRECT_UNSTAKE') return 'Unstake'
    if (activeFlow.periphery.isLoadingRoute) return 'Fetching quote'
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

  // ============================================================================
  // Loading State
  // ============================================================================
  if (isLoadingPriorityTokens) {
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
      <div className="flex justify-end md:opacity-0 md:group-hover/widget:opacity-100 transition-opacity duration-200">
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
                    isLoading: activeFlow.periphery.isLoadingRoute
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
        isLoadingQuote={activeFlow.periphery.isLoadingRoute}
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
                disabled={
                  !activeFlow.periphery.prepareApproveEnabled ||
                  !!withdrawError ||
                  activeFlow.periphery.isLoadingRoute ||
                  withdrawAmount.isDebouncing
                }
                className="w-full"
                notification={approveNotificationParams}
              />
            )}
            <TxButton
              prepareWrite={activeFlow.actions.prepareWithdraw}
              transactionName={transactionName}
              disabled={
                !activeFlow.periphery.prepareWithdrawEnabled ||
                !!withdrawError ||
                activeFlow.periphery.isLoadingRoute ||
                withdrawAmount.isDebouncing
              }
              loading={activeFlow.periphery.isLoadingRoute}
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
          activeFlow.periphery.resetQuote?.()
        }}
        chainId={chainId}
        value={selectedToken}
        excludeTokens={stakingAddress ? [stakingAddress] : undefined}
        priorityTokens={commonTokensByChain}
      />
    </div>
  )
}

// Re-export types
export * from './types'
