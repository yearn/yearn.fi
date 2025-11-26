import { Dialog, Transition } from '@headlessui/react'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import type { TNormalizedBN } from '@lib/types'
import { cl, formatAmount, formatTAmount, toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { TxButton } from '@nextgen/components/TxButton'
import { useDirectUnstake } from '@nextgen/hooks/actions/useDirectUnstake'
import { useDirectWithdraw } from '@nextgen/hooks/actions/useDirectWithdraw'
import { useEnsoWithdraw } from '@nextgen/hooks/actions/useEnsoWithdraw'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import type { UseWidgetWithdrawFlowReturn } from '@nextgen/types'
import { type FC, Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { InputTokenAmountV2 } from '../InputTokenAmountV2'
import { TokenSelector } from '../TokenSelector'
import { SettingsPopover } from './SettingsPopover'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  stakingAddress?: Address
  chainId: number
  vaultSymbol: string
  vaultType?: 'v2' | 'v3'
  handleWithdrawSuccess?: () => void
}

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

const InfoModal: FC<InfoModalProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                  {title}
                </Dialog.Title>
                {children}
                <div className="mt-6">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                    onClick={onClose}
                  >
                    Got it, thanks!
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

interface WithdrawDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  vaultSymbol: string
  withdrawAmount: string
  stakingAddress?: Address
  withdrawalSource?: 'vault' | 'staking' | null
  stakingTokenSymbol?: string
}

const WithdrawDetailsModal: FC<WithdrawDetailsModalProps> = ({
  isOpen,
  onClose,
  vaultSymbol,
  withdrawAmount,
  stakingAddress,
  withdrawalSource,
  stakingTokenSymbol
}) => {
  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Withdrawal Details">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          You are withdrawing {withdrawAmount}{' '}
          {withdrawalSource === 'staking' && stakingTokenSymbol ? stakingTokenSymbol : vaultSymbol} from the{' '}
          {withdrawalSource === 'staking' ? 'staking contract' : 'vault'}.
          {stakingAddress && withdrawalSource === 'staking' && ' Your tokens will be automatically unstaked.'}
        </p>
        <div className="space-y-3">
          <p className="font-medium text-sm text-gray-900">Withdrawal notes:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 ml-2">
            <li>You will receive your underlying assets</li>
            <li>Any earned yield will be included</li>
            <li>The transaction cannot be reversed</li>
          </ul>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Make sure you have enough gas to complete the withdrawal transaction.
        </p>
      </div>
    </InfoModal>
  )
}

export const WidgetWithdrawFinal: FC<Props> = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  vaultSymbol,
  handleWithdrawSuccess: onWithdrawSuccess
}) => {
  const { address: account } = useAccount()
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showWithdrawDetailsModal, setShowWithdrawDetailsModal] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [withdrawalSource, setWithdrawalSource] = useState<'vault' | 'staking' | null>(stakingAddress ? null : 'vault') // Default to vault for smooth UI (prevents balance flickering)

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
  } = useTokens(priorityTokenAddresses, chainId)

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

  // Get output token from wallet context (for cross-chain or other tokens)
  const outputToken = useMemo(() => {
    // If the selected token is one of our priority tokens on the same chain, use it
    if (destinationChainId === chainId && withdrawToken === assetAddress) {
      return assetToken
    }
    // Otherwise, get it from the wallet context
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
    // If no source selected, return empty balance
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

  // Use output token decimals for the input
  const withdrawInput = useDebouncedInput(assetToken?.decimals ?? 18)
  const [withdrawAmount, , setWithdrawInput] = withdrawInput

  // Get settings from Yearn context
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled, getPrice } = useYearn()

  // Determine source token based on withdrawal source selection
  const sourceToken = useMemo(() => {
    if (withdrawalSource === 'vault') {
      return vaultAddress
    } else if (withdrawalSource === 'staking' && stakingAddress) {
      return stakingAddress
    }
    // Default to vault address to avoid errors, but this shouldn't be used when no source is selected
    return vaultAddress
  }, [withdrawalSource, vaultAddress, stakingAddress])

  // Check if this is an unstake operation (withdrawing from staking to vault token)
  const isUnstake = withdrawalSource === 'staking' && toAddress(withdrawToken) === toAddress(vaultAddress)

  // Determine routing type: direct withdraw, unstake, or Enso
  const routeType = useMemo(() => {
    // Case 1: Direct withdraw (vault → asset, same token, from vault source)
    if (
      toAddress(withdrawToken) === toAddress(assetAddress) &&
      withdrawalSource === 'vault' &&
      chainId === outputToken.chainID
    ) {
      return 'DIRECT_WITHDRAW'
    }

    // Case 2: Unstake (staking → vault tokens)
    if (isUnstake) {
      return 'DIRECT_UNSTAKE'
    }

    // Case 3: Everything else uses Enso
    return 'ENSO'
  }, [withdrawToken, chainId, outputToken.chainID, assetAddress, withdrawalSource, isUnstake])

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

    // For unstake operations, calculate shares needed from staking token
    if (isUnstake) {
      return (
        (withdrawAmount.debouncedBn * 10n ** BigInt(stakingToken?.decimals ?? 18)) / (stakingPricePerShare as bigint)
      )
    }

    // For all other cases (DIRECT_WITHDRAW and ENSO), calculate from pricePerShare
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

  // Withdrawal flow using Enso - now uses the unified hook
  const ensoFlow = useEnsoWithdraw({
    vaultAddress: sourceToken,
    withdrawToken,
    amount: requiredShares,
    account,
    receiver: account, // Same as fromAddress for withdrawals
    chainId,
    destinationChainId,
    decimalsOut: outputToken?.decimals ?? 18,
    enabled: routeType === 'ENSO' && !!withdrawToken && !withdrawAmount.isDebouncing && requiredShares > 0n,
    slippage: zapSlippage * 100 // Convert percentage to basis points
  })

  // Select active flow based on routing type - returns unified UseWidgetWithdrawFlowReturn
  const activeFlow = useMemo((): UseWidgetWithdrawFlowReturn => {
    if (routeType === 'DIRECT_WITHDRAW') return directWithdraw
    if (routeType === 'DIRECT_UNSTAKE') return directUnstake
    return ensoFlow
  }, [routeType, directWithdraw, directUnstake, ensoFlow])

  // Error handling
  const withdrawError = useMemo(() => {
    if (hasBothBalances && !withdrawalSource) {
      return 'Please select withdrawal source'
    }
    if (withdrawAmount.bn === 0n) return null

    // Check balance for all flows using unified requiredShares
    if (requiredShares > totalVaultBalance.raw) {
      return 'Insufficient balance'
    }

    // ENSO-specific error: route not found
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

  // Shared function to handle successful withdrawals
  const handleWithdrawSuccess = useCallback(() => {
    setWithdrawInput('')
    // Refresh wallet balances
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

  const actionLabel = useMemo(() => {
    if (isUnstake) {
      return 'You will unstake'
    }
    if (withdrawalSource === 'staking') {
      return 'You will unstake and redeem'
    }
    return 'You will redeem'
  }, [isUnstake, withdrawalSource])

  // Compute transaction name based on flow type
  const transactionName = useMemo(() => {
    if (routeType === 'DIRECT_WITHDRAW') {
      return 'Withdraw'
    }
    if (routeType === 'DIRECT_UNSTAKE') {
      return 'Unstake'
    }
    // ENSO flow
    if (activeFlow.periphery.isLoadingRoute) {
      return 'Finding route...'
    }
    if (!activeFlow.periphery.isAllowanceSufficient) {
      return 'Approve First'
    }
    if (activeFlow.periphery.isCrossChain) {
      return 'Cross-chain Withdraw'
    }
    return 'Withdraw'
  }, [
    routeType,
    activeFlow.periphery.isLoadingRoute,
    activeFlow.periphery.isAllowanceSufficient,
    activeFlow.periphery.isCrossChain
  ])

  // Determine if we should show approve button (only for ENSO flow)
  const showApprove = routeType === 'ENSO'

  // Get the real USD price for the asset token (what the user is withdrawing)
  const assetTokenPrice = useMemo(() => {
    if (!assetToken?.address || !assetToken?.chainID) return 0
    return getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
  }, [assetToken?.address, assetToken?.chainID, getPrice])

  // Get the real USD price for the output token (in case of zap)
  const outputTokenPrice = useMemo(() => {
    if (!outputToken?.address || !outputToken?.chainID) return 0
    return getPrice({ address: toAddress(outputToken.address), chainID: outputToken.chainID }).normalized
  }, [outputToken?.address, outputToken?.chainID, getPrice])

  // Show loading state while priority tokens are loading
  if (isLoadingPriorityTokens) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col relative">
      {/* Settings Popover */}
      <div className="flex justify-end px-6 py-1 h-6">
        <SettingsPopover
          slippage={zapSlippage}
          setSlippage={setZapSlippage}
          maximizeYield={isAutoStakingEnabled}
          setMaximizeYield={setIsAutoStakingEnabled}
        />
      </div>

      {/* Withdraw From Selector - shown when user has both balances */}
      {hasBothBalances ? (
        <div className="px-6 pb-4">
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm text-gray-900">Withdraw from</label>
            <div className="relative">
              <select
                value={withdrawalSource || ''}
                onChange={(e) => setWithdrawalSource(e.target.value as 'vault' | 'staking' | null)}
                className="bg-white border border-gray-200 rounded-md h-9 w-full px-3 py-2 text-sm text-gray-900 appearance-none pr-10"
              >
                <option value="">Not selected</option>
                <option value="vault">Vault shares</option>
                <option value="staking">Staking contract</option>
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      ) : null}

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
            // Show token selector only when no zap is selected (default state)
            showTokenSelector={withdrawToken === assetAddress}
            onTokenSelectorClick={() => setShowTokenSelector(true)}
            onInputChange={(value) => {
              // Handle special max calculations
              if (value === totalBalanceInUnderlying.raw) {
                if (isUnstake) {
                  // For unstake, use the exact vault token balance
                  if (totalVaultBalance.raw > 0n) {
                    const amount =
                      (totalVaultBalance.raw * (stakingPricePerShare as bigint)) /
                      10n ** BigInt(stakingToken?.decimals ?? 18)

                    const exactAmount = formatUnits(amount, stakingToken?.decimals ?? 18)
                    withdrawInput[2](exactAmount)
                  }
                } else {
                  // For all other cases, just use the totalBalanceInUnderlying
                  const exactAmount = formatUnits(totalBalanceInUnderlying.raw, assetToken?.decimals ?? 18)
                  withdrawInput[2](exactAmount)
                }
              }
            }}
            // Zap token props
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
                    isLoading: activeFlow.periphery.isLoadingRoute || withdrawAmount.isDebouncing
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
      <div className="px-6">
        {/* Details */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-gray-500 ">{actionLabel}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowWithdrawDetailsModal(true)}
                className="inline-flex items-center justify-center hover:bg-gray-100 rounded-full p-0.5 transition-colors"
              >
                <svg
                  className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              <p className="text-sm text-gray-900">
                {activeFlow.periphery.isLoadingRoute ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <>
                    {requiredShares > 0n
                      ? formatTAmount({
                          value: requiredShares,
                          decimals: isUnstake ? (stakingToken?.decimals ?? 18) : (vault?.decimals ?? 18)
                        })
                      : '0'}{' '}
                    {'Vault shares'}
                  </>
                )}
              </p>
            </div>
          </div>
          {withdrawToken !== assetAddress && !isUnstake ? (
            <div className="flex items-center justify-between h-5">
              <p className="text-sm text-gray-500">You will swap</p>
              <div className="flex items-center gap-1">
                <p className="text-sm text-gray-900">
                  {withdrawAmount.simple} {assetToken?.symbol}
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-gray-500">You will receive{routeType === 'ENSO' ? ' at least' : ''}</p>
            <div className="flex items-center gap-1">
              <p className="text-sm text-gray-900">
                {activeFlow.periphery.isLoadingRoute ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : activeFlow.periphery.expectedOut > 0n ? (
                  `${formatAmount(
                    Number(formatUnits(activeFlow.periphery.expectedOut, outputToken?.decimals ?? 18)),
                    3,
                    6
                  )} ${outputToken?.symbol}`
                ) : (
                  `0 ${outputToken?.symbol || 'tokens'}`
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={'px-6 pt-6 pb-6'}>
        <div className="flex gap-2 w-full">
          {showApprove && activeFlow.actions.prepareApprove && (
            <TxButton
              prepareWrite={activeFlow.actions.prepareApprove}
              transactionName="Approve"
              disabled={
                !activeFlow.periphery.prepareApproveEnabled || !!withdrawError || activeFlow.periphery.isLoadingRoute
              }
              tooltip={
                withdrawError || (activeFlow.periphery.isLoadingRoute ? 'Calculating required amount...' : undefined)
              }
              className="w-full"
            />
          )}
          <TxButton
            prepareWrite={activeFlow.actions.prepareWithdraw}
            transactionName={transactionName}
            disabled={!activeFlow.periphery.prepareWithdrawEnabled || !!withdrawError}
            loading={activeFlow.periphery.isLoadingRoute}
            tooltip={
              withdrawError ||
              (!activeFlow.periphery.isAllowanceSufficient && showApprove ? 'Please approve token first' : undefined)
            }
            onSuccess={handleWithdrawSuccess}
            className="w-full"
          />
        </div>
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
      <div
        className="absolute z-50"
        style={{
          top: '-48px', // Adjust to cover the tabs
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: showTokenSelector ? 'auto' : 'none'
        }}
      >
        {/* Semi-transparent backdrop with fade animation */}
        <div
          className={cl(
            'absolute inset-0 bg-black/5 rounded-xl transition-opacity duration-200',
            showTokenSelector ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setShowTokenSelector(false)}
        />
        {/* Token selector overlay with slide and fade animation */}
        <div
          className={cl(
            'absolute inset-0 transition-all duration-300 ease-out',
            showTokenSelector ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          )}
        >
          <TokenSelector
            value={selectedToken}
            onChange={(address, chainId) => {
              setSelectedToken(address)
              setSelectedChainId(chainId)
              setShowTokenSelector(false)
            }}
            chainId={chainId}
            excludeTokens={stakingAddress ? [stakingAddress] : undefined}
            onClose={() => setShowTokenSelector(false)}
          />
        </div>
      </div>
    </div>
  )
}
