import { Dialog, Transition } from '@headlessui/react'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { cl, formatAmount, formatPercent, formatTAmount } from '@lib/utils'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useEnsoOrder } from '@nextgen/hooks/useEnsoOrder'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, Fragment, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { TokenSelector } from '../TokenSelector'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  stakingAddress?: Address
  chainId: number
  vaultAPR: number // APR as a percentage (e.g., 10.5 for 10.5%)
  vaultSymbol: string
  destinationChainId?: number // For cross-chain operations
  handleDepositSuccess?: () => void
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

interface VaultSharesModalProps {
  isOpen: boolean
  onClose: () => void
  vaultSymbol: string
  expectedShares: string
  stakingAddress?: Address
  isAutoStakingEnabled: boolean
}

const VaultSharesModal: FC<VaultSharesModalProps> = ({
  isOpen,
  onClose,
  vaultSymbol,
  expectedShares,
  stakingAddress,
  isAutoStakingEnabled
}) => {
  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Vault Shares">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          After depositing into the vault, you will receive{' '}
          {isAutoStakingEnabled && stakingAddress ? 'staked vault' : 'vault'} tokens which serve as proof that you have
          deposited into the vault.
        </p>
        <div className="space-y-3">
          <p className="font-medium text-sm text-gray-900">Token details:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 ml-2">
            <li>Symbol: {vaultSymbol}</li>
            <li>
              Your shares: {expectedShares} {vaultSymbol}
            </li>
            <li>Redeemable for your deposited assets plus earnings</li>
            {stakingAddress && (
              <li className={cl(isAutoStakingEnabled ? '' : 'line-through')}>Automatically staked for maximum APY</li>
            )}
          </ul>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          You can use these tokens to withdraw your deposit and any accrued returns at any time.
        </p>
      </div>
    </InfoModal>
  )
}

interface AnnualReturnModalProps {
  isOpen: boolean
  onClose: () => void
  depositAmount: string
  tokenSymbol?: string
  estimatedReturn: string
  currentAPR: number
}

const AnnualReturnModal: FC<AnnualReturnModalProps> = ({
  isOpen,
  onClose,
  depositAmount,
  tokenSymbol,
  estimatedReturn,
  currentAPR
}) => {
  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Estimated Annual Return">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          The estimated annual return is calculated based on the vault's historical performance and current market
          conditions.
        </p>
        <div className="space-y-3">
          <p className="font-medium text-sm text-gray-900">Calculation factors:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 ml-2">
            <li>Current APR: {formatPercent(currentAPR * 100, 2, 2, 500)}</li>
            <li>
              Your deposit: {depositAmount} {tokenSymbol}
            </li>
            <li>
              Expected annual yield: ~{estimatedReturn} {tokenSymbol}
            </li>
          </ul>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Please note that past performance does not guarantee future results. Actual returns may vary based on market
          volatility and vault strategy adjustments.
        </p>
      </div>
    </InfoModal>
  )
}

export const WidgetDepositGeneric: FC<Props> = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  vaultAPR,
  vaultSymbol,
  destinationChainId,
  handleDepositSuccess: onDepositSuccess
}) => {
  const { address: account } = useAccount()
  const { onRefresh: refreshWalletBalances } = useWallet()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showVaultSharesModal, setShowVaultSharesModal] = useState(false)
  const [showAnnualReturnModal, setShowAnnualReturnModal] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Determine which token to use for deposits
  const depositToken = selectedToken || assetAddress
  // Include staking token in the tokens list if available
  const tokensToFetch = stakingAddress ? [depositToken, vaultAddress, stakingAddress] : [depositToken, vaultAddress]
  const { tokens, refetch: refetchTokens } = useTokens(tokensToFetch, chainId)
  const [inputToken, vault, stakingToken] = tokens

  const depositInput = useDebouncedInput(inputToken?.decimals ?? 18)
  const [depositAmount, , setDepositInput] = depositInput

  // Get settings from Yearn context
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled } = useYearn()

  // Determine destination token based on auto-staking setting
  const destinationToken = useMemo(() => {
    // If auto-staking is enabled and a staking address is available, use it
    if (isAutoStakingEnabled && stakingAddress) {
      return stakingAddress
    }
    // Otherwise, use the vault address
    return vaultAddress
  }, [isAutoStakingEnabled, stakingAddress, vaultAddress])

  // Deposit flow using Enso
  const {
    actions: { prepareApprove },
    periphery: { prepareApproveEnabled, route, isLoadingRoute, expectedOut, routerAddress, isCrossChain, allowance },
    getRoute,
    getEnsoTransaction
  } = useSolverEnso({
    tokenIn: depositToken,
    tokenOut: destinationToken,
    amountIn: depositAmount.debouncedBn,
    fromAddress: account,
    chainId,
    destinationChainId,
    decimalsOut: vault?.decimals ?? 18,
    slippage: zapSlippage * 100, // Convert percentage to basis points (e.g., 0.5% -> 50 basis points)
    enabled: !!depositToken && !depositAmount.isDebouncing
  })

  // Fetch route when debounced amount changes
  useEffect(() => {
    if (depositAmount.debouncedBn > 0n && !depositAmount.isDebouncing) {
      getRoute()
    }
  }, [depositAmount.debouncedBn, depositAmount.isDebouncing, getRoute])

  // Error handling
  const depositError = useMemo(() => {
    if (depositAmount.bn === 0n) return null
    if (depositAmount.bn > (inputToken?.balance.raw || 0n)) {
      return 'Insufficient balance'
    }
    if (!route && !isLoadingRoute && depositAmount.debouncedBn > 0n && !depositAmount.isDebouncing) {
      return 'Unable to find route'
    }
    return null
  }, [
    depositAmount.bn,
    depositAmount.debouncedBn,
    depositAmount.isDebouncing,
    inputToken?.balance.raw,
    route,
    isLoadingRoute
  ])

  const isAllowanceSufficient = !routerAddress || allowance >= depositAmount.bn
  const canDeposit = route && !depositError && depositAmount.bn > 0n && isAllowanceSufficient

  // Use the new useEnsoOrder hook for cleaner integration with TxButton
  const { prepareEnsoOrder, receiptSuccess, txHash } = useEnsoOrder({
    getEnsoTransaction,
    enabled: canDeposit,
    chainId
  })

  // Check if we're waiting for transaction
  const isWaitingForTx = !!txHash && !receiptSuccess

  // Handle successful transaction receipt
  useEffect(() => {
    if (receiptSuccess && txHash) {
      setDepositInput('')
      refetchTokens()
      // Refresh wallet balances to update TokenSelector and other components
      const walletsToRefresh = [
        { address: depositToken, chainID: chainId },
        { address: vaultAddress, chainID: chainId }
      ]
      if (stakingAddress) {
        walletsToRefresh.push({ address: stakingAddress, chainID: chainId })
      }
      refreshWalletBalances(walletsToRefresh)
      onDepositSuccess?.()
    }
  }, [
    receiptSuccess,
    txHash,
    setDepositInput,
    refetchTokens,
    refreshWalletBalances,
    depositToken,
    vaultAddress,
    chainId,
    onDepositSuccess,
    stakingAddress
  ])

  const estimatedAnnualReturn = useMemo(() => {
    if (depositAmount.bn === 0n || vaultAPR === 0) return '0'

    const depositValue = formatTAmount({ value: depositAmount.debouncedBn, decimals: inputToken?.decimals ?? 18 })
    const annualReturn = Number(depositValue) * vaultAPR

    return annualReturn.toFixed(2)
  }, [depositAmount.bn, depositAmount.debouncedBn, vaultAPR, inputToken?.decimals])

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
                  Balance: {formatAmount(inputToken?.balance.normalized || 0)} {inputToken?.symbol}
                </p>
              </div>
              <div className="relative flex items-center gap-2">
                <div className="bg-white border border-gray-200 rounded-md h-9 flex-1">
                  <div className="flex gap-1 h-9 items-center px-3 py-1">
                    <input
                      type="text"
                      value={depositAmount.formValue}
                      onChange={(e) => depositInput[1](e)}
                      placeholder="0"
                      disabled={isWaitingForTx}
                      className="flex-1 font-normal text-sm text-gray-900 outline-none bg-transparent"
                    />
                    <span className="text-sm text-zinc-500 font-normal">{inputToken?.symbol}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (inputToken?.balance.raw) {
                      const fullBalance = inputToken.balance.normalized.toString()
                      depositInput[2](fullBalance)
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
        {/* Deposit Token Selector */}
        <div className="flex flex-col gap-2 mb-6">
          <label className="font-medium text-sm text-gray-900">Deposit Token</label>
          <button
            onClick={() => setShowTokenSelector(!showTokenSelector)}
            className="bg-white border border-gray-200 rounded-md h-9 w-full flex items-center justify-between px-3 py-2"
          >
            <span className="font-normal text-sm text-gray-900">{inputToken?.symbol || 'Select Token'}</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">You will deposit</p>
            <p className="text-sm text-gray-900">
              {depositAmount.bn > 0n
                ? formatTAmount({
                    value: depositAmount.bn,
                    decimals: inputToken?.decimals ?? 18
                  })
                : '0'}{' '}
              {inputToken?.symbol}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">You will receive</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowVaultSharesModal(true)}
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
                {isLoadingRoute || depositAmount.isDebouncing ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : depositAmount.bn > 0n && route ? (
                  `${formatAmount(expectedOut.normalized)} ${isAutoStakingEnabled && stakingAddress ? stakingToken?.symbol || vaultSymbol : vaultSymbol}`
                ) : (
                  `0 ${isAutoStakingEnabled && stakingAddress ? stakingToken?.symbol || vaultSymbol : vaultSymbol}`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Est. Annual Return</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAnnualReturnModal(true)}
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
                {depositAmount.bn > 0n && route ? `~${estimatedAnnualReturn} ${inputToken?.symbol}` : '~0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={cl('px-6 pt-6', showAdvancedSettings ? 'pb-6' : 'pb-2')}>
        <div className="flex gap-2 w-full">
          <TxButton
            prepareWrite={prepareApprove}
            transactionName="Approve"
            disabled={!prepareApproveEnabled || !!depositError}
            tooltip={depositError || undefined}
            className="w-full"
          />
          <TxButton
            prepareWrite={prepareEnsoOrder}
            transactionName={
              isLoadingRoute || depositAmount.isDebouncing
                ? 'Finding route...'
                : !isAllowanceSufficient
                  ? 'Approve First'
                  : isCrossChain
                    ? 'Cross-chain Deposit'
                    : 'Deposit'
            }
            disabled={!canDeposit || isLoadingRoute || depositAmount.isDebouncing}
            loading={isLoadingRoute || depositAmount.isDebouncing}
            tooltip={depositError || (!isAllowanceSufficient ? 'Please approve token first' : undefined)}
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

              {stakingAddress && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="space-y-0.5">
                    <label htmlFor="maximize-yield" className="text-sm text-gray-600">
                      Maximize Yield
                    </label>
                    <p className="text-xs text-gray-400">Auto-stake for maximum APY</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={isAutoStakingEnabled}
                    onClick={() => setIsAutoStakingEnabled(!isAutoStakingEnabled)}
                    className={cl(
                      'relative inline-flex h-5 w-10 items-center rounded-full transition-colors',
                      isAutoStakingEnabled ? 'bg-gray-700' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={cl(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                        isAutoStakingEnabled ? 'translate-x-5' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Vault Shares Modal */}
      <VaultSharesModal
        isOpen={showVaultSharesModal}
        onClose={() => setShowVaultSharesModal(false)}
        vaultSymbol={vaultSymbol}
        expectedShares={expectedOut.normalized ? formatAmount(expectedOut.normalized) : '0'}
        stakingAddress={stakingAddress}
        isAutoStakingEnabled={isAutoStakingEnabled}
      />

      {/* Annual Return Modal */}
      <AnnualReturnModal
        isOpen={showAnnualReturnModal}
        onClose={() => setShowAnnualReturnModal(false)}
        depositAmount={formatTAmount({ value: depositAmount.debouncedBn, decimals: inputToken?.decimals ?? 18 })}
        tokenSymbol={inputToken?.symbol}
        estimatedReturn={estimatedAnnualReturn}
        currentAPR={vaultAPR}
      />

      {/* Full-screen Token Selector Overlay */}
      <div
        className="absolute z-50"
        style={{
          top: '-48px', // Adjust to cover the tabs (assuming 48px tab height)
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
            excludeTokens={[vaultAddress]}
            onClose={() => setShowTokenSelector(false)}
          />
        </div>
      </div>
    </div>
  )
}
