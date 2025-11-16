import { Dialog, Transition } from '@headlessui/react'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import type { TNormalizedBN } from '@lib/types'
import { cl, formatAmount, formatTAmount, toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { gaugeV2Abi } from '@lib/utils/abi/gaugeV2.abi'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useEnsoOrder } from '@nextgen/hooks/useEnsoOrder'
import { type FC, Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits, parseUnits } from 'viem'
import { type UseSimulateContractReturnType, useAccount, useReadContract, useSimulateContract } from 'wagmi'
import { TokenSelector } from '../TokenSelector'

const tokensByChain: Record<number, Address[]> = {
  1: [
    // Ethereum mainnet
    ETH_TOKEN_ADDRESS, // ETH
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' // WBTC
  ],
  10: [
    // Optimism
    ETH_TOKEN_ADDRESS, // ETH
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
    '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
    '0x4200000000000000000000000000000000000006' // WETH
  ],
  137: [
    // Polygon
    ETH_TOKEN_ADDRESS, // MATIC
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
    '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
    '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // WMATIC
  ],
  42161: [
    // Arbitrum
    ETH_TOKEN_ADDRESS, // ETH
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // WETH
  ]
}

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
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showWithdrawDetailsModal, setShowWithdrawDetailsModal] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [isFetchingMaxQuote, setIsFetchingMaxQuote] = useState(false)
  const [requiredVaultTokensFromReverseQuote, setRequiredVaultTokensFromReverseQuote] = useState<bigint | null>(null)
  const [withdrawalSource, setWithdrawalSource] = useState<'vault' | 'staking' | null>(null)

  // Fetch pricePerShare to convert vault tokens to underlying
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
  const destinationChain = selectedChainId || chainId

  // Get tokens from wallet
  const vault = useMemo(() => getToken({ address: vaultAddress, chainID: chainId }), [getToken, vaultAddress, chainId])
  const stakingToken = useMemo(
    () => (stakingAddress ? getToken({ address: stakingAddress, chainID: chainId }) : undefined),
    [getToken, stakingAddress, chainId]
  )
  const outputToken = useMemo(
    () => getToken({ address: withdrawToken, chainID: destinationChain }),
    [getToken, withdrawToken, destinationChain]
  )
  const assetToken = useMemo(
    () => getToken({ address: assetAddress, chainID: chainId }),
    [getToken, assetAddress, chainId]
  )

  // Define common tokens for withdrawals
  const commonTokenAddresses = useMemo(() => {
    const baseTokens = tokensByChain[chainId] || []

    // Add vault token when withdrawing from staking
    if (withdrawalSource === 'staking' && vaultAddress) {
      return [...baseTokens, vaultAddress]
    }

    return baseTokens
  }, [chainId, withdrawalSource, vaultAddress])

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
  const withdrawInput = useDebouncedInput(outputToken?.decimals ?? 18)
  const [withdrawAmount, , setWithdrawInput] = withdrawInput

  // Get settings from Yearn context
  const { zapSlippage, setZapSlippage } = useYearn()

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

  // Function to fetch max quote from Enso
  const fetchMaxQuote = useCallback(async () => {
    if (!account || totalVaultBalance.raw === 0n || !outputToken) return
    if (hasBothBalances && !withdrawalSource) return
    // Skip for unstake operations
    if (isUnstake) return

    setIsFetchingMaxQuote(true)
    try {
      const ENSO_API_BASE = 'https://api.enso.finance/api/v1'
      const ENSO_API_KEY = import.meta.env.VITE_ENSO_API_KEY

      const params = new URLSearchParams({
        fromAddress: account,
        receiver: account, // Same as fromAddress for withdrawals
        chainId: chainId.toString(),
        tokenIn: sourceToken,
        tokenOut: withdrawToken,
        amountIn: totalVaultBalance.raw.toString(),
        slippage: (zapSlippage * 100).toString(),
        ...(destinationChain !== chainId && { destinationChainId: destinationChain.toString() })
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
  }, [
    account,
    totalVaultBalance,
    outputToken,
    chainId,
    sourceToken,
    withdrawToken,
    zapSlippage,
    setWithdrawInput,
    hasBothBalances,
    withdrawalSource,
    isUnstake,
    destinationChain
  ])

  // Reverse quote: For non-asset tokens, find how many vault tokens we need
  // Skip reverse quote for unstake operations
  const shouldFetchReverseQuote =
    !isUnstake && withdrawToken !== assetAddress && withdrawAmount.debouncedBn > 0n && !!withdrawToken

  const {
    periphery: { route: reverseRoute, isLoadingRoute: isLoadingReverseRoute },
    getRoute: getReverseRoute
  } = useSolverEnso({
    tokenIn: withdrawToken || assetAddress, // Fallback to asset address to prevent errors
    tokenOut: sourceToken, // We want to know how many vault tokens
    amountIn: withdrawAmount.debouncedBn,
    fromAddress: account,
    receiver: account, // Same as fromAddress for withdrawals
    chainId: destinationChain,
    decimalsOut: vault?.decimals ?? 18,
    slippage: zapSlippage * 100,
    enabled: shouldFetchReverseQuote && !withdrawAmount.isDebouncing
  })

  // Update required vault tokens from reverse quote
  useEffect(() => {
    if (reverseRoute?.minAmountOut && shouldFetchReverseQuote && BigInt(reverseRoute.minAmountOut) > 0n) {
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

    // For unstake operations, we need exactly the amount entered
    if (isUnstake) {
      return (
        (withdrawAmount.debouncedBn * 10n ** BigInt(stakingToken?.decimals ?? 18)) / (stakingPricePerShare as bigint)
      )
    }

    // If withdrawing to asset token directly, calculate vault tokens needed
    if (withdrawToken === assetAddress && pricePerShare) {
      const vaultDecimals = vault?.decimals ?? 18

      return (withdrawAmount.debouncedBn * 10n ** BigInt(vaultDecimals)) / (pricePerShare as bigint)
    }

    // For other tokens, use the reverse quote result
    return requiredVaultTokensFromReverseQuote || 0n
  }, [
    withdrawAmount.debouncedBn,
    isUnstake,
    pricePerShare,
    stakingToken?.decimals,
    stakingPricePerShare,
    withdrawToken,
    assetAddress,
    vault?.decimals,
    requiredVaultTokensFromReverseQuote
  ])
  // Withdrawal flow using Enso - using calculated vault tokens
  const {
    actions: { prepareApprove },
    periphery: { prepareApproveEnabled, route, isLoadingRoute, minExpectedOut, routerAddress, isCrossChain, allowance },
    getRoute,
    getEnsoTransaction
  } = useSolverEnso({
    tokenIn: sourceToken,
    tokenOut: withdrawToken,
    amountIn: requiredVaultTokens, // Use calculated vault tokens
    fromAddress: account,
    receiver: account, // Same as fromAddress for withdrawals
    chainId,
    destinationChainId: destinationChain,
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
    isLoadingRoute,
    hasBothBalances,
    withdrawalSource
  ])

  // Check if we're still loading the required vault tokens for non-asset withdrawals
  const isLoadingRequiredTokens = withdrawToken !== assetAddress && isLoadingReverseRoute

  // Unified loading state for UI elements
  const isLoadingAnyQuote = isLoadingRoute || isLoadingReverseRoute || withdrawAmount.isDebouncing

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

    if (isLoadingRequiredTokens) {
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
    isLoadingRequiredTokens,
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
        { address: withdrawToken, chainID: destinationChain },
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
    refreshWalletBalances,
    withdrawToken,
    vaultAddress,
    chainId,
    onWithdrawSuccess,
    stakingAddress
  ])

  return (
    <div className="flex flex-col relative">
      {/* Withdraw From Selector - shown when user has both balances */}
      {hasBothBalances && (
        <div className="px-6 pt-6 pb-4">
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
      )}

      {/* Amount Section */}
      <div className={cl('px-6 pb-6', hasBothBalances ? 'pt-2' : 'pt-6')}>
        {/* Amount Input */}
        <div className="flex flex-col gap-4">
          <div className="relative">
            <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-end">
                <label className="font-medium text-sm text-gray-900">Amount</label>
                <p className="text-[10px] text-zinc-500 font-medium">
                  {withdrawalSource === 'staking' ? 'Staking' : 'Vault'} Balance:{' '}
                  {formatAmount(totalBalanceInUnderlying.normalized)} {assetToken?.symbol || 'tokens'}
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
                      disabled={!!isWaitingForTx || !!isFetchingMaxQuote || (!!hasBothBalances && !withdrawalSource)}
                      className="flex-1 font-normal text-sm text-gray-900 outline-none bg-transparent"
                    />
                    <span className="text-sm text-zinc-500 font-normal">{outputToken?.symbol || 'tokens'}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (isUnstake) {
                      // For unstake, use the exact vault token balance
                      if (totalVaultBalance.raw > 0n) {
                        const amount =
                          (totalVaultBalance.raw * (stakingPricePerShare as bigint)) /
                          10n ** BigInt(stakingToken?.decimals ?? 18)

                        const exactAmount = formatUnits(amount, stakingToken?.decimals ?? 18)
                        withdrawInput[2](exactAmount)
                      }
                    } else if (totalBalanceInUnderlying.raw > 0n && assetToken) {
                      // For regular withdrawals
                      if (withdrawToken === assetAddress) {
                        const exactAmount = formatUnits(totalBalanceInUnderlying.raw, assetToken.decimals ?? 18)
                        withdrawInput[2](exactAmount)
                      } else {
                        fetchMaxQuote()
                      }
                    }
                  }}
                  disabled={!!isFetchingMaxQuote || (!!hasBothBalances && !withdrawalSource)}
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
            disabled={!!hasBothBalances && !withdrawalSource}
            className="bg-white border border-gray-200 rounded-md h-9 w-full flex items-center justify-between px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-sm text-gray-500">{isUnstake ? 'You will unstake' : 'You will redeem'}</p>
            <p className="text-sm text-gray-900">
              {isLoadingAnyQuote ? (
                <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
              ) : (
                <>
                  {requiredVaultTokens > 0n
                    ? formatTAmount({
                        value: requiredVaultTokens,
                        decimals: isUnstake ? (stakingToken?.decimals ?? 18) : (vault?.decimals ?? 18)
                      })
                    : '0'}{' '}
                  {withdrawalSource === 'staking' && stakingToken ? stakingToken.symbol : vaultSymbol}
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
                {isLoadingAnyQuote ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : minExpectedOut && minExpectedOut.normalized > 0 ? (
                  `${formatAmount(minExpectedOut.normalized, 3, 6)} ${outputToken?.symbol}`
                ) : (
                  `0 ${outputToken?.symbol || 'tokens'}`
                )}
              </p>
            </div>
          </div>
          {/* {stakingToken?.balance.raw && stakingToken.balance.raw > 0n && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">From staked</p>
              <p className="text-sm text-gray-900">
                {formatAmount(stakingToken.balance.normalized)} {vaultSymbol}
              </p>
            </div>
          )} */}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={cl('px-6 pt-6', showAdvancedSettings ? 'pb-6' : 'pb-2')}>
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
            limitTokens={commonTokenAddresses}
            excludeTokens={stakingAddress ? [stakingAddress] : undefined}
            onClose={() => setShowTokenSelector(false)}
          />
        </div>
      </div>
    </div>
  )
}
