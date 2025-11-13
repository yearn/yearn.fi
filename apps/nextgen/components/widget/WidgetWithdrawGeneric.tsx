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
import { type FC, Fragment, useEffect, useMemo, useState } from 'react'
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

  const withdrawInput = useDebouncedInput(vault?.decimals ?? 18)
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

  // Withdrawal flow using Enso
  const {
    actions: { prepareApprove },
    periphery: { prepareApproveEnabled, route, isLoadingRoute, expectedOut, routerAddress, isCrossChain, allowance },
    getRoute,
    getEnsoTransaction
  } = useSolverEnso({
    tokenIn: sourceToken,
    tokenOut: withdrawToken,
    amountIn: withdrawAmount.debouncedBn,
    fromAddress: account,
    chainId,
    destinationChainId,
    decimalsOut: outputToken?.decimals ?? 18,
    slippage: zapSlippage * 100, // Convert percentage to basis points
    enabled: !!withdrawToken && !withdrawAmount.isDebouncing
  })

  // Fetch route when debounced amount changes
  useEffect(() => {
    if (withdrawAmount.debouncedBn > 0n && !withdrawAmount.isDebouncing) {
      getRoute()
    }
  }, [withdrawAmount.debouncedBn, withdrawAmount.isDebouncing, getRoute])

  // Error handling
  const withdrawError = useMemo(() => {
    if (withdrawAmount.bn === 0n) return null
    if (withdrawAmount.bn > totalVaultBalance) {
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
    route,
    isLoadingRoute
  ])

  const isAllowanceSufficient = !routerAddress || allowance >= withdrawAmount.bn
  const canWithdraw = route && !withdrawError && withdrawAmount.bn > 0n && isAllowanceSufficient

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

  // Keep vault token balance for max button
  const totalBalanceNormalized = useMemo(() => {
    if (!vault) return '0'
    return formatTAmount({
      value: totalVaultBalance,
      decimals: vault.decimals ?? 18
    })
  }, [totalVaultBalance, vault])

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
                      disabled={isWaitingForTx}
                      className="flex-1 font-normal text-sm text-gray-900 outline-none bg-transparent"
                    />
                    <span className="text-sm text-zinc-500 font-normal">{vaultSymbol}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (totalVaultBalance > 0n) {
                      withdrawInput[2](totalBalanceNormalized)
                    }
                  }}
                  className="bg-white border border-gray-200 flex gap-2 h-9 items-center justify-center px-8 py-2 rounded-md"
                >
                  <span className="font-medium text-sm text-gray-900">Max</span>
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
            <p className="text-sm text-gray-500">You will withdraw</p>
            <p className="text-sm text-gray-900">
              {withdrawAmount.bn > 0n
                ? formatTAmount({
                    value: withdrawAmount.bn,
                    decimals: vault?.decimals ?? 18
                  })
                : '0'}{' '}
              {vaultSymbol}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">You will receive</p>
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
                {isLoadingRoute || withdrawAmount.isDebouncing ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : withdrawAmount.bn > 0n && route ? (
                  `${formatAmount(expectedOut.normalized)} ${outputToken?.symbol}`
                ) : (
                  `0 ${outputToken?.symbol}`
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
            disabled={!prepareApproveEnabled || !!withdrawError}
            tooltip={withdrawError || undefined}
            className="w-full"
          />
          <TxButton
            prepareWrite={prepareEnsoOrder}
            transactionName={
              isLoadingRoute || withdrawAmount.isDebouncing
                ? 'Finding route...'
                : !isAllowanceSufficient
                  ? 'Approve First'
                  : isCrossChain
                    ? 'Cross-chain Withdraw'
                    : 'Withdraw'
            }
            disabled={!canWithdraw || isLoadingRoute || withdrawAmount.isDebouncing}
            loading={isLoadingRoute || withdrawAmount.isDebouncing}
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
          withdrawAmount.bn > 0n ? formatTAmount({ value: withdrawAmount.bn, decimals: vault?.decimals ?? 18 }) : '0'
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
