import { Dialog, Transition } from '@headlessui/react'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import type { TNormalizedBN } from '@lib/types'
import { cl, formatAmount, formatTAmount, toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { gaugeV2Abi } from '@lib/utils/abi/gaugeV2.abi'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useEnsoOrder } from '@nextgen/hooks/useEnsoOrder'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, Fragment, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { type UseSimulateContractReturnType, useAccount, useReadContract, useSimulateContract } from 'wagmi'
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

  const { tokens: priorityTokens, isLoading: isLoadingPriorityTokens } = useTokens(priorityTokenAddresses, chainId)

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

  // Calculate required vault tokens based on desired output
  const requiredVaultTokens = useMemo(() => {
    if (!withdrawAmount.debouncedBn || withdrawAmount.debouncedBn === 0n) return 0n

    // For unstake operations, we need exactly the amount entered
    if (isUnstake) {
      return (
        (withdrawAmount.debouncedBn * 10n ** BigInt(stakingToken?.decimals ?? 18)) / (stakingPricePerShare as bigint)
      )
    }

    // Always calculate vault tokens from asset amount
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

  // Withdrawal flow using Enso - using calculated vault tokens
  const {
    actions: { prepareApprove },
    periphery: {
      prepareApproveEnabled,
      route,
      error,
      isLoadingRoute,
      expectedOut,
      minExpectedOut,
      routerAddress,
      isCrossChain,
      allowance
    },
    getRoute,
    getEnsoTransaction
  } = useSolverEnso({
    tokenIn: sourceToken,
    tokenOut: withdrawToken,
    amountIn: requiredVaultTokens, // Use calculated vault tokens
    fromAddress: account,
    receiver: account, // Same as fromAddress for withdrawals
    chainId,
    destinationChainId,
    decimalsOut: outputToken?.decimals ?? 18,
    slippage: zapSlippage * 100, // Convert percentage to basis points
    enabled: !!withdrawToken && !withdrawAmount.isDebouncing && requiredVaultTokens > 0n
  })
  // Fetch forward route when we have the required vault tokens
  useEffect(() => {
    if (requiredVaultTokens > 0n && !withdrawAmount.isDebouncing) {
      getRoute()
    }
  }, [requiredVaultTokens, withdrawAmount.isDebouncing, getRoute])

  // Error handling
  const withdrawError = useMemo(() => {
    if (hasBothBalances && !withdrawalSource) {
      return 'Please select withdrawal source'
    }
    if (withdrawAmount.bn === 0n) return null
    if (requiredVaultTokens > totalVaultBalance.raw) {
      return 'Insufficient balance'
    }
    if (error && !route && !isLoadingRoute && withdrawAmount.debouncedBn > 0n && !withdrawAmount.isDebouncing) {
      return 'Unable to find route'
    }
    return null
  }, [
    withdrawAmount.bn,
    withdrawAmount.debouncedBn,
    withdrawAmount.isDebouncing,
    totalVaultBalance,
    requiredVaultTokens,
    route,
    error,
    isLoadingRoute,
    hasBothBalances,
    withdrawalSource
  ])

  // Unified loading state for UI elements
  const isLoadingAnyQuote = isLoadingRoute

  const isAllowanceSufficient = isUnstake || !routerAddress || allowance >= requiredVaultTokens

  // Determine if withdrawal can proceed
  const canWithdraw = useMemo(() => {
    // Common checks
    if (withdrawError || withdrawAmount.bn === 0n) {
      return false
    }

    if (isUnstake) {
      // Convert staking token balance into vault shares balance e.g ysyBOLD -> yBOLD
      const stakingBalanceInVaultToken =
        (totalVaultBalance.raw * (stakingPricePerShare as bigint)) / 10n ** BigInt(stakingToken?.decimals ?? 18)
      // For unstaking, just check if amount is within balance
      return withdrawAmount.bn <= stakingBalanceInVaultToken
    }

    // For regular withdrawals via Enso
    if (!route) {
      return false
    }

    if (!isAllowanceSufficient) {
      return false
    }

    // If user has both vault and staking balances, they must select a source
    if (hasBothBalances && !withdrawalSource) {
      return false
    }

    return true
  }, [
    withdrawError,
    withdrawAmount.bn,
    isUnstake,
    totalVaultBalance.raw,
    route,
    stakingPricePerShare,
    stakingToken?.decimals,
    isAllowanceSufficient,
    hasBothBalances,
    withdrawalSource
  ])

  // Prepare unstake transaction
  const prepareUnstake: UseSimulateContractReturnType = useSimulateContract({
    abi: gaugeV2Abi,
    functionName: 'withdraw',
    address: stakingAddress,
    args: stakingAddress && account ? [withdrawAmount.bn, account, account] : undefined,
    chainId,
    query: { enabled: isUnstake && canWithdraw && !!stakingAddress && !!account }
  })

  // Use the useEnsoOrder hook for cleaner integration with TxButton
  const { prepareEnsoOrder, receiptSuccess, txHash } = useEnsoOrder({
    getEnsoTransaction,
    enabled: canWithdraw && !isUnstake,
    chainId
  })

  // Check if we're waiting for transaction
  const isWaitingForTx = !!txHash && !receiptSuccess

  // Handle successful transaction receipt
  useEffect(() => {
    if (receiptSuccess && txHash) {
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
      onWithdrawSuccess?.()
    }
  }, [
    receiptSuccess,
    txHash,
    setWithdrawInput,
    destinationChainId,
    refreshWalletBalances,
    withdrawToken,
    vaultAddress,
    chainId,
    onWithdrawSuccess,
    stakingAddress
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
            disabled={!!isWaitingForTx || (!!hasBothBalances && !withdrawalSource)}
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
                      expectedOut && expectedOut.normalized > 0 ? formatAmount(expectedOut.normalized, 6, 6) : '0',
                    isLoading: isLoadingRoute || withdrawAmount.isDebouncing
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
                {isLoadingAnyQuote || prepareApprove.isLoading || prepareEnsoOrder.isLoading ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <>
                    {requiredVaultTokens > 0n
                      ? formatTAmount({
                          value: requiredVaultTokens,
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
          {/* TODO: This should display You will receive at least only in case of zap. Change this when we support vanilla withdrawals */}
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-gray-500">You will receive at least</p>
            <div className="flex items-center gap-1">
              <p className="text-sm text-gray-900">
                {isLoadingAnyQuote || prepareApprove.isLoading || prepareEnsoOrder.isLoading ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : minExpectedOut && minExpectedOut.normalized > 0 ? (
                  `${formatAmount(minExpectedOut.normalized, 3, 6)} ${outputToken?.symbol}`
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
          {isUnstake ? (
            // For unstake operations, show single button
            <TxButton
              prepareWrite={prepareUnstake}
              transactionName="Unstake"
              disabled={!canWithdraw || !!withdrawError}
              tooltip={withdrawError || undefined}
              className="w-full"
            />
          ) : (
            // For regular withdrawals, show approve + withdraw
            <>
              <TxButton
                prepareWrite={prepareApprove}
                transactionName="Approve"
                disabled={!prepareApproveEnabled || !!withdrawError || isLoadingAnyQuote}
                tooltip={withdrawError || (isLoadingAnyQuote ? 'Calculating required amount...' : undefined)}
                className="w-full"
              />
              <TxButton
                prepareWrite={prepareEnsoOrder}
                transactionName={
                  isLoadingAnyQuote
                    ? 'Finding route...'
                    : !isAllowanceSufficient
                      ? 'Approve First'
                      : isCrossChain
                        ? 'Cross-chain Withdraw'
                        : 'Withdraw'
                }
                disabled={!canWithdraw || isLoadingAnyQuote}
                loading={isLoadingAnyQuote}
                tooltip={withdrawError || (!isAllowanceSufficient ? 'Please approve token first' : undefined)}
                className="w-full"
              />
            </>
          )}
        </div>
      </div>

      {/* Withdraw Details Modal */}
      <WithdrawDetailsModal
        isOpen={showWithdrawDetailsModal}
        onClose={() => setShowWithdrawDetailsModal(false)}
        vaultSymbol={vaultSymbol}
        withdrawAmount={
          requiredVaultTokens > 0n
            ? formatTAmount({ value: requiredVaultTokens, decimals: vault?.decimals ?? 18 })
            : '0'
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
