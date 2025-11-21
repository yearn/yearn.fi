import { Dialog, Transition } from '@headlessui/react'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { cl, formatAmount, formatPercent, formatTAmount, toAddress } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useEnsoOrder } from '@nextgen/hooks/useEnsoOrder'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, Fragment, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { InputTokenAmountV2 } from '../InputTokenAmountV2'
import { TokenSelector } from '../TokenSelector'
import { SettingsPopover } from './SettingsPopover'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  stakingAddress?: Address
  chainId: number
  vaultAPR: number // APR as a percentage (e.g., 10.5 for 10.5%)
  vaultSymbol: string
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

export const WidgetDepositFinal: FC<Props> = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  vaultAPR,
  vaultSymbol,
  handleDepositSuccess: onDepositSuccess
}) => {
  const { address: account } = useAccount()
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showVaultSharesModal, setShowVaultSharesModal] = useState(false)
  const [showAnnualReturnModal, setShowAnnualReturnModal] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)

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
  const [assetToken, vault] = priorityTokens

  // Determine which token to use for deposits
  const depositToken = selectedToken || assetAddress

  // Get tokens from wallet - use selected chain or default to vault chain
  const sourceChainId = selectedChainId || chainId
  const inputToken = useMemo(() => {
    // If the selected token is one of our priority tokens on the same chain, use it
    if (sourceChainId === chainId && depositToken === assetAddress) {
      return assetToken
    }
    // Otherwise, get it from the wallet context (for cross-chain or other tokens)
    return getToken({ address: depositToken, chainID: sourceChainId })
  }, [getToken, depositToken, sourceChainId, chainId, assetAddress, assetToken])

  const depositInput = useDebouncedInput(inputToken?.decimals ?? 18)
  const [depositAmount, , setDepositInput] = depositInput

  // Get settings from Yearn context
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled, getPrice } = useYearn()

  // Fetch pricePerShare to convert vault shares to underlying
  const { data: pricePerShare } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'pricePerShare',
    chainId
  })

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
    periphery: {
      prepareApproveEnabled,
      route,
      error,
      isLoadingRoute,
      expectedOut,
      routerAddress,
      isCrossChain,
      allowance
    },
    getRoute,
    getEnsoTransaction
  } = useSolverEnso({
    tokenIn: depositToken,
    tokenOut: destinationToken,
    amountIn: depositAmount.debouncedBn,
    fromAddress: account,
    receiver: account, // Same as fromAddress for deposits
    chainId: sourceChainId,
    destinationChainId: chainId, // Vault is always on the original chain
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
    if (error && !route && !isLoadingRoute && depositAmount.debouncedBn > 0n && !depositAmount.isDebouncing) {
      return 'Unable to find route'
    }
    return null
  }, [
    depositAmount.bn,
    depositAmount.debouncedBn,
    depositAmount.isDebouncing,
    inputToken?.balance.raw,
    route,
    error,
    isLoadingRoute
  ])
  // Check if the selected token is ETH (native token)
  const isNativeToken = toAddress(depositToken) === toAddress(ETH_TOKEN_ADDRESS)

  // Native tokens don't need approval
  const isAllowanceSufficient = isNativeToken || !routerAddress || allowance >= depositAmount.bn
  const canDeposit = route && !depositError && depositAmount.bn > 0n && isAllowanceSufficient

  // Use the new useEnsoOrder hook for cleaner integration with TxButton
  const { prepareEnsoOrder, receiptSuccess, txHash } = useEnsoOrder({
    getEnsoTransaction,
    enabled: canDeposit,
    chainId: sourceChainId // Execute transaction on source chain
  })

  // Check if we're waiting for transaction
  const isWaitingForTx = !!txHash && !receiptSuccess

  // Handle successful transaction receipt
  useEffect(() => {
    if (receiptSuccess && txHash) {
      setDepositInput('')
      // Refresh wallet balances to update TokenSelector and other components
      const tokensToRefresh = [
        { address: depositToken, chainID: sourceChainId },
        { address: vaultAddress, chainID: chainId }
      ]
      if (stakingAddress) {
        tokensToRefresh.push({ address: stakingAddress, chainID: chainId })
      }
      refreshWalletBalances(tokensToRefresh)
      onDepositSuccess?.()
    }
  }, [
    receiptSuccess,
    txHash,
    setDepositInput,
    refreshWalletBalances,
    depositToken,
    sourceChainId,
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

  // Enso returns the expected output in the destination token (vault or staking), we need to convert it to the selected token
  const expectedOutInSelectedToken = useMemo(() => {
    if (!route || !pricePerShare || !assetToken?.decimals) return 0n
    return (BigInt(route.minAmountOut) * pricePerShare) / 10n ** BigInt(assetToken.decimals)
  }, [route, route?.minAmountOut, assetToken?.decimals, pricePerShare])

  // Get the real USD price for the input token
  const inputTokenPrice = useMemo(() => {
    if (!inputToken?.address || !inputToken?.chainID) return 0
    return getPrice({ address: toAddress(inputToken.address), chainID: inputToken.chainID }).normalized
  }, [inputToken?.address, inputToken?.chainID, getPrice])

  // Get the real USD price for the output token (vault or asset when zapping)
  const outputTokenPrice = useMemo(() => {
    // When not zapping, output is in vault shares (we don't show USD for vault shares)
    if (depositToken === assetAddress) return 0
    
    // When zapping, we're converting input to asset, so show asset price
    if (!assetToken?.address || !assetToken?.chainID) return 0
    return getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
  }, [depositToken, assetAddress, assetToken?.address, assetToken?.chainID, getPrice])

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

      {/* Amount Section */}
      <div className="px-6 pb-6">
        <InputTokenAmountV2
          input={depositInput}
          title="Amount"
          placeholder="0.00"
          balance={inputToken?.balance.raw}
          decimals={inputToken?.decimals}
          symbol={inputToken?.symbol}
          disabled={isWaitingForTx}
          errorMessage={depositError || undefined}
          showTokenSelector
          inputTokenUsdPrice={inputTokenPrice}
          outputTokenUsdPrice={outputTokenPrice}
          tokenAddress={inputToken?.address}
          tokenChainId={inputToken?.chainID}
          onTokenSelectorClick={() => setShowTokenSelector(true)}
        />
      </div>

      {/* Details Section */}
      <div className="px-6">
        {/* Details */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {'You will ' + (selectedToken === assetAddress ? 'deposit' : 'swap')}
            </p>
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
          {selectedToken !== assetAddress && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{'For at least'}</p>
              <p className="text-sm text-gray-900">
                {isLoadingRoute || prepareApprove.isLoading || prepareEnsoOrder.isLoading ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : expectedOutInSelectedToken > 0n && route ? (
                  `${formatTAmount({
                    value: expectedOutInSelectedToken,
                    decimals: assetToken?.decimals ?? 18
                  })} ${assetToken?.symbol || 'tokens'}`
                ) : (
                  `0 ${assetToken?.symbol || 'tokens'}`
                )}
              </p>
            </div>
          )}
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
                {isLoadingRoute || prepareApprove.isLoading || prepareEnsoOrder.isLoading ? (
                  <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ) : depositAmount.bn > 0n && route ? (
                  `${formatAmount(expectedOut.normalized)} Vault shares`
                ) : (
                  `0 Vault shares`
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
                {depositAmount.bn > 0n && route ? `~${estimatedAnnualReturn}` : '0'} {inputToken?.symbol}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 pt-6 pb-6">
        <div className="flex gap-2 w-full">
          {!isNativeToken && (
            <TxButton
              prepareWrite={prepareApprove}
              transactionName="Approve"
              disabled={!prepareApproveEnabled || !!depositError}
              tooltip={depositError || undefined}
              className="w-full"
            />
          )}
          <TxButton
            prepareWrite={prepareEnsoOrder}
            transactionName={
              isLoadingRoute || depositAmount.isDebouncing
                ? 'Finding route...'
                : !isAllowanceSufficient && !isNativeToken
                  ? 'Approve First'
                  : isCrossChain
                    ? 'Cross-chain Deposit'
                    : 'Deposit'
            }
            disabled={!canDeposit || isLoadingRoute || depositAmount.isDebouncing}
            loading={isLoadingRoute || depositAmount.isDebouncing}
            tooltip={
              depositError || (!isAllowanceSufficient && !isNativeToken ? 'Please approve token first' : undefined)
            }
            className="w-full"
          />
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
            onChange={(address, chainId) => {
              setSelectedToken(address)
              setSelectedChainId(chainId)
              setShowTokenSelector(false)
            }}
            chainId={sourceChainId}
            excludeTokens={[vaultAddress]}
            onClose={() => setShowTokenSelector(false)}
          />
        </div>
      </div>
    </div>
  )
}
