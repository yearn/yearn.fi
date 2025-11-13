import { Dialog, Transition } from '@headlessui/react'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { cl, formatAmount, formatTAmount } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useEnsoOrder } from '@nextgen/hooks/useEnsoOrder'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, erc4626Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { TokenSelector } from '../TokenSelector'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  stakingAddress?: Address
  chainId: number
  vaultSymbol: string
  vaultType?: 'v2' | 'v3'
  destinationChainId?: number // For cross-chain operations
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
}

const WithdrawDetailsModal: FC<WithdrawDetailsModalProps> = ({
  isOpen,
  onClose,
  vaultSymbol,
  withdrawAmount,
  stakingAddress
}) => {
  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Withdrawal Details">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          You are withdrawing {withdrawAmount} {vaultSymbol} from the vault.
          {stakingAddress && ' Your tokens will be automatically unstaked if needed.'}
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

export const WidgetWithdrawGeneric: FC<Props> = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  vaultSymbol,
  destinationChainId,
  handleWithdrawSuccess: onWithdrawSuccess
}) => {
  const { address: account } = useAccount()
  const { onRefresh: refreshWalletBalances } = useWallet()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showWithdrawDetailsModal, setShowWithdrawDetailsModal] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [isFetchingMaxQuote, setIsFetchingMaxQuote] = useState(false)
  const [requiredVaultTokensFromReverseQuote, setRequiredVaultTokensFromReverseQuote] = useState<bigint | null>(null)

  // Fetch pricePerShare to convert vault tokens to underlying
  const { data: pricePerShare } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'pricePerShare',
    chainId
  })

  // Determine which token to use for withdrawals
  const withdrawToken = selectedToken || assetAddress

  // For withdrawals, we need to check both vault and staking balances, plus the asset token
  const tokensToFetch = stakingAddress
    ? [vaultAddress, stakingAddress, withdrawToken, assetAddress]
    : [vaultAddress, withdrawToken, assetAddress]

  const { tokens, refetch: refetchTokens } = useTokens(tokensToFetch, chainId)
  const [vault, stakingToken, outputToken, assetToken] = stakingAddress
    ? tokens
    : [tokens[0], undefined, tokens[1], tokens[2]]

  // Combined balance from vault and staking (if available) in vault tokens
  const totalVaultBalance = useMemo(() => {
    const vaultBalance = vault?.balance.raw || 0n
    const stakingBalance = stakingToken?.balance.raw || 0n
    return vaultBalance + stakingBalance
  }, [vault?.balance.raw, stakingToken?.balance.raw])

  // Convert vault balance to underlying tokens
  const totalBalanceInUnderlying = useMemo(() => {
    if (!pricePerShare || totalVaultBalance === 0n) return 0n

    const vaultDecimals = vault?.decimals ?? 18
    return (totalVaultBalance * (pricePerShare as bigint)) / 10n ** BigInt(vaultDecimals)
  }, [totalVaultBalance, pricePerShare, vault?.decimals])

  // Use output token decimals for the input
  const withdrawInput = useDebouncedInput(outputToken?.decimals ?? 18)
  const [withdrawAmount, , setWithdrawInput] = withdrawInput

  // Get settings from Yearn context
  const { zapSlippage, setZapSlippage } = useYearn()

  // Determine source token based on auto-staking setting and balance
  const sourceToken = useMemo(() => {
    // If we have staking balance and auto-staking is enabled, prioritize unstaking
    if (stakingAddress && stakingToken?.balance.raw && stakingToken.balance.raw > 0n) {
      return stakingAddress
    }
    // Otherwise, use the vault address
    return vaultAddress
  }, [stakingAddress, stakingToken?.balance.raw, vaultAddress])

  // Function to fetch max quote from Enso
  const fetchMaxQuote = useCallback(async () => {
    if (!account || totalVaultBalance === 0n || !outputToken) return

    setIsFetchingMaxQuote(true)
    try {
      const ENSO_API_BASE = 'https://api.enso.finance/api/v1'
      const ENSO_API_KEY = import.meta.env.VITE_ENSO_API_KEY

      const params = new URLSearchParams({
        fromAddress: account,
        chainId: chainId.toString(),
        tokenIn: sourceToken,
        tokenOut: withdrawToken,
        amountIn: totalVaultBalance.toString(),
        slippage: (zapSlippage * 100).toString()
      })

      const response = await fetch(`${ENSO_API_BASE}/shortcuts/route?${params}`, {
        headers: {
          Authorization: `Bearer ${ENSO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.amountOut) {
          // Set the expected output amount in the input
          const outputAmount = BigInt(data.amountOut)
          const normalizedAmount = formatTAmount({
            value: outputAmount,
            decimals: outputToken.decimals ?? 18
          })
          setWithdrawInput(normalizedAmount)
        }
      }
    } catch (error) {
      console.error('Failed to fetch max quote:', error)
    } finally {
      setIsFetchingMaxQuote(false)
    }
  }, [account, totalVaultBalance, outputToken, chainId, sourceToken, withdrawToken, zapSlippage, setWithdrawInput])

  // Reverse quote: For non-asset tokens, find how many vault tokens we need
  const shouldFetchReverseQuote = withdrawToken !== assetAddress && withdrawAmount.debouncedBn > 0n && !!withdrawToken

  const {
    periphery: { route: reverseRoute, isLoadingRoute: isLoadingReverseRoute },
    getRoute: getReverseRoute
  } = useSolverEnso({
    tokenIn: withdrawToken || assetAddress, // Fallback to asset address to prevent errors
    tokenOut: sourceToken, // We want to know how many vault tokens
    amountIn: withdrawAmount.debouncedBn,
    fromAddress: account,
    chainId,
    decimalsOut: vault?.decimals ?? 18,
    slippage: zapSlippage * 100,
    enabled: shouldFetchReverseQuote && !withdrawAmount.isDebouncing
  })

  // Update required vault tokens from reverse quote
  useEffect(() => {
    if (reverseRoute?.minAmountOut && shouldFetchReverseQuote && BigInt(reverseRoute.minAmountOut) > 0n) {
      // Add a small buffer (0.1%) to ensure we have enough vault tokens
      setRequiredVaultTokensFromReverseQuote(BigInt(reverseRoute.minAmountOut))
    } else if (!shouldFetchReverseQuote) {
      setRequiredVaultTokensFromReverseQuote(null)
    }
  }, [reverseRoute?.minAmountOut, shouldFetchReverseQuote])

  // Fetch reverse route when needed
  useEffect(() => {
    if (shouldFetchReverseQuote && !withdrawAmount.isDebouncing) {
      getReverseRoute()
    }
  }, [shouldFetchReverseQuote, withdrawAmount.isDebouncing, getReverseRoute])

  // Calculate required vault tokens based on desired output
  const requiredVaultTokens = useMemo(() => {
    if (!withdrawAmount.debouncedBn || withdrawAmount.debouncedBn === 0n) return 0n

    // If withdrawing to asset token directly, calculate vault tokens needed
    if (withdrawToken === assetAddress && pricePerShare) {
      const assetDecimals = assetToken?.decimals ?? 18
      const vaultDecimals = vault?.decimals ?? 18

      // Convert desired asset amount to vault tokens
      // vaultTokens = assetAmount * 10^vaultDecimals / pricePerShare
      return (withdrawAmount.debouncedBn * 10n ** BigInt(vaultDecimals)) / (pricePerShare as bigint)
    }

    // For other tokens, use the reverse quote result
    return requiredVaultTokensFromReverseQuote || 0n
  }, [
    withdrawAmount.debouncedBn,
    pricePerShare,
    withdrawToken,
    assetAddress,
    assetToken?.decimals,
    vault?.decimals,
    requiredVaultTokensFromReverseQuote
  ])
  // Withdrawal flow using Enso - using calculated vault tokens
  const {
    actions: { prepareApprove },
    periphery: { prepareApproveEnabled, route, isLoadingRoute, expectedOut, routerAddress, isCrossChain, allowance },
    getRoute,
    getEnsoTransaction
  } = useSolverEnso({
    tokenIn: sourceToken,
    tokenOut: withdrawToken,
    amountIn: requiredVaultTokens, // Use calculated vault tokens
    fromAddress: account,
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
    if (withdrawAmount.bn === 0n) return null
    if (requiredVaultTokens > totalVaultBalance) {
      return 'Insufficient balance'
    }
    if (!route && !isLoadingRoute && withdrawAmount.debouncedBn > 0n && !withdrawAmount.isDebouncing) {
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
    isLoadingRoute
  ])

  // Check if we're still loading the required vault tokens for non-asset withdrawals
  const isLoadingRequiredTokens = withdrawToken !== assetAddress && isLoadingReverseRoute

  const isAllowanceSufficient = !routerAddress || allowance >= requiredVaultTokens
  const canWithdraw =
    route && !withdrawError && withdrawAmount.bn > 0n && isAllowanceSufficient && !isLoadingRequiredTokens

  // Use the useEnsoOrder hook for cleaner integration with TxButton
  const { prepareEnsoOrder, receiptSuccess, txHash } = useEnsoOrder({
    getEnsoTransaction,
    enabled: canWithdraw,
    chainId
  })

  // Check if we're waiting for transaction
  const isWaitingForTx = !!txHash && !receiptSuccess

  // Handle successful transaction receipt
  useEffect(() => {
    if (receiptSuccess && txHash) {
      setWithdrawInput('')
      refetchTokens()
      // Refresh wallet balances
      const walletsToRefresh = [
        { address: withdrawToken, chainID: chainId },
        { address: vaultAddress, chainID: chainId }
      ]
      if (stakingAddress) {
        walletsToRefresh.push({ address: stakingAddress, chainID: chainId })
      }
      refreshWalletBalances(walletsToRefresh)
      onWithdrawSuccess?.()
    }
  }, [
    receiptSuccess,
    txHash,
    setWithdrawInput,
    refetchTokens,
    refreshWalletBalances,
    withdrawToken,
    vaultAddress,
    chainId,
    onWithdrawSuccess,
    stakingAddress
  ])

  // Format balance in underlying tokens for display
  const totalBalanceInUnderlyingNormalized = useMemo(() => {
    if (!assetToken) return '0'
    return formatTAmount({
      value: totalBalanceInUnderlying,
      decimals: assetToken.decimals ?? 18
    })
  }, [totalBalanceInUnderlying, assetToken])


  return (
    <div className="flex flex-col relative">
      {/* Amount Section */}
      <div className="px-6 pt-6 pb-6">
        {/* Amount Input */}
        <div className="flex flex-col gap-4">
          <div className="relative">
            <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-end">
                <label className="font-medium text-sm text-gray-900">Amount</label>
                <p className="text-[10px] text-zinc-500 font-medium">
                  Vault Balance: {formatAmount(Number(totalBalanceInUnderlyingNormalized))}{' '}
                  {assetToken?.symbol || 'tokens'}
                </p>
              </div>
              <div className="relative flex items-center gap-2">
                <div className="bg-white border border-gray-200 rounded-md h-9 flex-1">
                  <div className="flex gap-1 h-9 items-center px-3 py-1">
                    <input
                      type="text"
                      value={withdrawAmount.formValue}
                      onChange={(e) => withdrawInput[1](e)}
                      placeholder="0"
                      disabled={isWaitingForTx || isFetchingMaxQuote}
                      className="flex-1 font-normal text-sm text-gray-900 outline-none bg-transparent"
                    />
                    <span className="text-sm text-zinc-500 font-normal">{outputToken?.symbol || 'tokens'}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (totalBalanceInUnderlying > 0n && assetToken) {
                      // If withdrawing to asset token, use the underlying balance directly
                      if (withdrawToken === assetAddress) {
                        withdrawInput[2](totalBalanceInUnderlyingNormalized)
                      } else {
                        // For other tokens, fetch quote from Enso
                        fetchMaxQuote()
                      }
                    }
                  }}
                  disabled={isFetchingMaxQuote}
                  className="bg-white border border-gray-200 flex gap-2 h-9 items-center justify-center px-8 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed w-[88px]"
                >
                  {isFetchingMaxQuote ? (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : (
                    <span className="font-medium text-sm text-gray-900">Max</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Selection and Details */}
      <div className="px-6">
        {/* Withdraw Token Selector */}
        <div className="flex flex-col gap-2 mb-6">
          <label className="font-medium text-sm text-gray-900">Receive Token</label>
          <button
            onClick={() => setShowTokenSelector(!showTokenSelector)}
            className="bg-white border border-gray-200 rounded-md h-9 w-full flex items-center justify-between px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {outputToken && (
                <ImageWithFallback
                  src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${outputToken.address?.toLowerCase()}/logo-32.png`}
                  alt={outputToken.symbol ?? ''}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              )}
              <span className="font-normal text-sm text-gray-900">{outputToken?.symbol || 'Select Token'}</span>
            </div>

            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">You will redeem</p>
            <p className="text-sm text-gray-900">
              {withdrawToken !== assetAddress && (isLoadingReverseRoute || withdrawAmount.isDebouncing) ? (
                <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
              ) : (
                <>
                  {requiredVaultTokens > 0n
                    ? formatTAmount({
                        value: requiredVaultTokens,
                        decimals: vault?.decimals ?? 18
                      })
                    : '0'}{' '}
                  {vaultSymbol}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">You will receive at least</p>
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
                {isLoadingRoute ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : expectedOut ? (
                  `${formatAmount(expectedOut.normalized, 3, 6)} ${outputToken?.symbol}`
                ) : (
                  `0 ${outputToken?.symbol || 'tokens'}`
                )}
              </p>
            </div>
          </div>
          {stakingToken?.balance.raw && stakingToken.balance.raw > 0n && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">From staked</p>
              <p className="text-sm text-gray-900">
                {formatAmount(stakingToken.balance.normalized)} {vaultSymbol}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={cl('px-6 pt-6', showAdvancedSettings ? 'pb-6' : 'pb-2')}>
        <div className="flex gap-2 w-full">
          <TxButton
            prepareWrite={prepareApprove}
            transactionName="Approve"
            disabled={!prepareApproveEnabled || !!withdrawError || isLoadingRequiredTokens}
            tooltip={withdrawError || (isLoadingRequiredTokens ? 'Calculating required amount...' : undefined)}
            className="w-full"
          />
          <TxButton
            prepareWrite={prepareEnsoOrder}
            transactionName={
              isLoadingRequiredTokens
                ? 'Calculating...'
                : isLoadingRoute || withdrawAmount.isDebouncing
                  ? 'Finding route...'
                  : !isAllowanceSufficient
                    ? 'Approve First'
                    : isCrossChain
                      ? 'Cross-chain Withdraw'
                      : 'Withdraw'
            }
            disabled={!canWithdraw || isLoadingRoute || withdrawAmount.isDebouncing || isLoadingRequiredTokens}
            loading={isLoadingRoute || withdrawAmount.isDebouncing || isLoadingRequiredTokens}
            tooltip={withdrawError || (!isAllowanceSufficient ? 'Please approve token first' : undefined)}
            className="w-full"
          />
        </div>

        {/* Advanced Settings */}
        <div className="mt-1 flex flex-col items-center">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className={cl('h-3 w-3 transition-transform', showAdvancedSettings ? 'rotate-180' : 'rotate-0')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Advanced settings
          </button>

          {showAdvancedSettings && (
            <div className="mt-3 w-full space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="slippage" className="text-sm text-gray-600">
                  Slippage Tolerance
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={zapSlippage}
                    onChange={(e) => setZapSlippage(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-sm border border-gray-200 text-gray-900 text-right rounded focus:outline-none focus:ring-1 focus:ring-gray-300"
                    step="0.1"
                    min="0"
                    max="50"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
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
            onChange={(address) => {
              setSelectedToken(address)
              setShowTokenSelector(false)
            }}
            chainId={chainId}
            excludeTokens={stakingAddress ? [vaultAddress, stakingAddress] : [vaultAddress]}
            onClose={() => setShowTokenSelector(false)}
          />
        </div>
      </div>
    </div>
  )
}
