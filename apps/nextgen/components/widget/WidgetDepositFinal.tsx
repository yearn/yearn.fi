import { Dialog, Transition } from '@headlessui/react'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { cl, formatAmount, formatPercent, formatTAmount, toAddress, toNormalizedBN } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import { TxButton } from '@nextgen/components/TxButton'
import { useDirectDeposit } from '@nextgen/hooks/actions/useDirectDeposit'
import { useDirectStake } from '@nextgen/hooks/actions/useDirectStake'
import { useEnsoDeposit } from '@nextgen/hooks/actions/useEnsoDeposit'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import type { TTxButtonNotificationParams } from '@nextgen/types'
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
  vaultAPR: number // APR as a percentage (e.g., 10.5 for 10.5%)
  vaultSymbol: string
  stakingSource?: string
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-surface p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-text-primary mb-4">
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
        <p className="text-sm text-text-secondary">
          After depositing into the vault, you will receive{' '}
          {isAutoStakingEnabled && stakingAddress ? 'staked vault' : 'vault'} tokens which serve as proof that you have
          deposited into the vault.
        </p>
        <div className="space-y-3">
          <p className="font-medium text-sm text-text-primary">Token details:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-text-secondary ml-2">
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
        <p className="text-xs text-text-secondary mt-4">
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
        <p className="text-sm text-text-secondary">
          The estimated annual return is calculated based on the vault's historical performance and current market
          conditions.
        </p>
        <div className="space-y-3">
          <p className="font-medium text-sm text-text-primary">Calculation factors:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-text-secondary ml-2">
            <li>Current APR: {formatPercent(currentAPR * 100, 2, 2, 500)}</li>
            <li>
              Your deposit: {depositAmount} {tokenSymbol}
            </li>
            <li>
              Expected annual yield: ~{estimatedReturn} {tokenSymbol}
            </li>
          </ul>
        </div>
        <p className="text-xs text-text-secondary mt-4">
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
  stakingSource,
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
  const {
    tokens: priorityTokens,
    isLoading: isLoadingPriorityTokens,
    refetch: refetchPriorityTokens
  } = useTokens(priorityTokenAddresses, chainId, account)

  // Extract priority tokens
  const [assetToken, vault, stakingToken] = priorityTokens

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

  // State for MAX button quote fetching
  const [isFetchingMaxQuote, setIsFetchingMaxQuote] = useState(false)

  // Get settings from Yearn context
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled, getPrice } = useYearn()

  // Check if the selected token is ETH (native token)
  const isNativeToken = toAddress(depositToken) === toAddress(ETH_TOKEN_ADDRESS)

  // Determine destination token based on auto-staking setting
  const destinationToken = useMemo(() => {
    // If auto-staking is enabled and a staking address is available, use it
    if (isAutoStakingEnabled && stakingAddress) {
      return stakingAddress
    }
    // Otherwise, use the vault address
    return vaultAddress
  }, [isAutoStakingEnabled, stakingAddress, vaultAddress])

  // Manual fetch for MAX button - gets gas estimate for full balance
  const fetchMaxQuote = useCallback(async () => {
    if (!isNativeToken || !account || !inputToken?.balance.raw || !depositToken) {
      return
    }

    setIsFetchingMaxQuote(true)
    try {
      const ENSO_API_BASE = 'https://api.enso.finance/api/v1'
      const ENSO_API_KEY = import.meta.env.VITE_ENSO_API_KEY

      // Determine if cross-chain: source chain differs from vault chain
      const isCrossChain = sourceChainId !== chainId
      const params = new URLSearchParams({
        fromAddress: account,
        chainId: sourceChainId.toString(),
        tokenIn: depositToken,
        tokenOut: destinationToken,
        amountIn: inputToken.balance.raw.toString(),
        slippage: (zapSlippage * 100).toString(),
        ...(isCrossChain && { destinationChainId: chainId.toString() }),
        receiver: account
      })

      const response = await fetch(`${ENSO_API_BASE}/shortcuts/route?${params}`, {
        headers: {
          Authorization: `Bearer ${ENSO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.error) {
        console.error('Enso MAX quote error:', data.message)
        return
      }

      // Calculate adjusted balance and set input directly
      const gasEstimate = BigInt(data.gas)
      const gasPriceGwei = 20n
      const gasPrice = gasPriceGwei * 1_000_000_000n
      const gasReserve = (gasEstimate * gasPrice * 120n) / 100n
      const rawBalance = inputToken.balance.raw

      if (gasReserve >= rawBalance) {
        setDepositInput('0')
      } else {
        const adjustedBalance = rawBalance - gasReserve
        setDepositInput(formatUnits(adjustedBalance, inputToken.decimals ?? 18))
      }
    } catch (error) {
      console.error('Failed to fetch MAX quote:', error)
    } finally {
      setIsFetchingMaxQuote(false)
    }
  }, [
    isNativeToken,
    account,
    inputToken?.balance.raw,
    inputToken?.decimals,
    depositToken,
    destinationToken,
    sourceChainId,
    chainId,
    zapSlippage,
    setDepositInput
  ])

  // Fetch pricePerShare to convert vault shares to underlying
  const { data: pricePerShare } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'pricePerShare',
    chainId
  })

  // Determine routing type: direct deposit, direct stake, or Enso
  const routeType = useMemo(() => {
    // Case 1: Direct vault deposit (asset → vault)
    if (
      toAddress(depositToken) === toAddress(assetAddress) &&
      toAddress(destinationToken) === toAddress(vaultAddress)
    ) {
      return 'DIRECT_DEPOSIT'
    }

    // Case 2: Direct staking (vault → staking)
    if (
      toAddress(depositToken) === toAddress(vaultAddress) &&
      stakingAddress &&
      toAddress(destinationToken) === toAddress(stakingAddress)
    ) {
      return 'DIRECT_STAKE'
    }

    // Case 3: All other cases use Enso
    return 'ENSO'
  }, [depositToken, assetAddress, destinationToken, vaultAddress, stakingAddress])

  // Direct deposit hook (Case 1: asset → vault)
  const directDeposit = useDirectDeposit({
    vaultAddress,
    assetAddress,
    amount: depositAmount.debouncedBn,
    account,
    chainId,
    decimals: inputToken?.decimals ?? 18,
    enabled: routeType === 'DIRECT_DEPOSIT' && depositAmount.debouncedBn > 0n
  })

  // Direct stake hook (Case 2: vault → staking)
  const directStake = useDirectStake({
    stakingAddress,
    vaultAddress,
    amount: depositAmount.debouncedBn,
    account,
    chainId,
    decimals: vault?.decimals ?? 18,
    stakingSource,
    enabled: routeType === 'DIRECT_STAKE' && depositAmount.debouncedBn > 0n
  })

  // Deposit flow using Enso - now uses the unified hook
  const ensoFlow = useEnsoDeposit({
    vaultAddress: destinationToken,
    depositToken,
    amount: depositAmount.debouncedBn,
    account,
    chainId: sourceChainId,
    destinationChainId: chainId, // Vault is always on the original chain
    decimalsOut: vault?.decimals ?? 18,
    enabled: routeType === 'ENSO' && !!depositToken && depositAmount.debouncedBn > 0n && depositAmount.bn > 0n, // Ensure current input is also > 0 to prevent fetching with stale debounced value
    slippage: zapSlippage * 100 // Convert percentage to basis points
  })
  // Select active flow based on routing type - all hooks return UseWidgetDepositFlowReturn
  const activeFlow = useMemo(() => {
    if (routeType === 'DIRECT_DEPOSIT') return directDeposit
    if (routeType === 'DIRECT_STAKE') return directStake
    return ensoFlow
  }, [routeType, directDeposit, directStake, ensoFlow])

  // Error handling (using activeFlow)
  const depositError = useMemo(() => {
    if (depositAmount.bn === 0n || activeFlow.periphery.isLoadingRoute) return null
    if (depositAmount.bn > (inputToken?.balance.raw || 0n)) {
      return 'Insufficient balance'
    }

    if (selectedToken === vaultAddress && !isAutoStakingEnabled) {
      return "Please toggle 'Maximize Yield' switch in settings to stake"
    }
    if (
      activeFlow.periphery.error &&
      !activeFlow.periphery.isLoadingRoute &&
      depositAmount.debouncedBn > 0n &&
      !depositAmount.isDebouncing
    ) {
      return 'Unable to find route'
    }
    return null
  }, [
    depositAmount.bn,
    depositAmount.debouncedBn,
    depositAmount.isDebouncing,
    inputToken?.balance.raw,
    activeFlow.periphery.error,
    activeFlow.periphery.isLoadingRoute,
    isAutoStakingEnabled,
    selectedToken,
    vaultAddress
  ])

  // Notification parameters for approve transaction
  const approveNotificationParams = useMemo((): TTxButtonNotificationParams | undefined => {
    if (!inputToken || !vault || !account) return undefined

    // Only create approve params for ENSO and DIRECT_STAKE (DIRECT_DEPOSIT doesn't need approval)
    if (routeType === 'DIRECT_DEPOSIT') return undefined

    // Determine spender based on route type
    let spenderAddress: Address
    let spenderName: string

    if (routeType === 'ENSO') {
      // For ENSO approvals, spender is the router contract
      spenderAddress = activeFlow.periphery.routerAddress || destinationToken
      spenderName = activeFlow.periphery.routerAddress ? 'Enso Router' : vault.symbol || ''
    } else if (routeType === 'DIRECT_STAKE') {
      // For DIRECT_STAKE, spender is the staking contract
      spenderAddress = stakingAddress || destinationToken
      spenderName = 'Staking Contract'
    } else {
      return undefined
    }

    return {
      type: 'approve',
      actionParams: {
        amount: inputToken.balance,
        selectedOptionFrom: {
          label: inputToken.symbol || '',
          value: toAddress(depositToken),
          symbol: inputToken.symbol || '',
          decimals: inputToken.decimals ?? 18,
          chainID: sourceChainId
        },
        selectedOptionTo: {
          label: spenderName,
          value: toAddress(spenderAddress),
          symbol: spenderName,
          decimals: vault.decimals ?? 18,
          chainID: chainId
        }
      }
    }
  }, [
    inputToken,
    vault,
    account,
    routeType,
    activeFlow.periphery.routerAddress,
    depositToken,
    sourceChainId,
    destinationToken,
    chainId,
    stakingAddress
  ])

  // Notification parameters for deposit transaction
  const depositNotificationParams = useMemo((): TTxButtonNotificationParams | undefined => {
    if (!inputToken || !vault || !account || depositAmount.bn === 0n) return undefined

    // Determine notification type based on routing
    let notificationType: 'deposit' | 'zap' | 'crosschain zap' | 'stake' = 'deposit'
    if (routeType === 'ENSO') {
      // Use 'zap' for same-chain ENSO, 'crosschain zap' for cross-chain ENSO
      notificationType = activeFlow.periphery.isCrossChain ? 'crosschain zap' : 'zap'
    } else if (routeType === 'DIRECT_STAKE') {
      notificationType = 'stake'
    }

    // Determine destination token details
    // For DIRECT_STAKE, use the staking token's symbol if available
    const destinationTokenSymbol =
      routeType === 'DIRECT_STAKE' && stakingToken ? stakingToken.symbol || vault.symbol || '' : vault.symbol || ''

    return {
      type: notificationType,
      actionParams: {
        amount: toNormalizedBN(depositAmount.bn, inputToken.decimals ?? 18),
        selectedOptionFrom: {
          label: inputToken.symbol || '',
          value: toAddress(depositToken),
          symbol: inputToken.symbol || '',
          decimals: inputToken.decimals ?? 18,
          chainID: sourceChainId
        },
        selectedOptionTo: {
          label: destinationTokenSymbol,
          value: toAddress(destinationToken),
          symbol: destinationTokenSymbol,
          decimals: vault.decimals ?? 18,
          chainID: chainId
        }
      }
    }
  }, [
    inputToken,
    vault,
    account,
    depositAmount.bn,
    routeType,
    activeFlow.periphery.isCrossChain,
    depositToken,
    sourceChainId,
    destinationToken,
    chainId,
    stakingToken
  ])

  // Deposit is enabled when: prepare is enabled, allowance is sufficient, no errors, and amount > 0
  const canDeposit =
    activeFlow.periphery.prepareDepositEnabled &&
    activeFlow.periphery.isAllowanceSufficient &&
    !depositError &&
    depositAmount.bn > 0n

  // Shared function to handle successful deposits
  const handleDepositSuccess = useCallback(() => {
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
    refetchPriorityTokens()
    onDepositSuccess?.()
  }, [
    setDepositInput,
    refreshWalletBalances,
    depositToken,
    sourceChainId,
    vaultAddress,
    chainId,
    stakingAddress,
    refetchPriorityTokens,
    onDepositSuccess
  ])

  // Combined loading state to prevent flickering between debouncing and route loading
  // Keep loading state active for a short time after debouncing ends to prevent gap
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)

  useEffect(() => {
    if (depositAmount.isDebouncing || activeFlow.periphery.isLoadingRoute) {
      setIsLoadingQuote(true)
      return
    }

    // Add a small delay before hiding loading state to prevent flickering
    const timeout = setTimeout(() => {
      setIsLoadingQuote(false)
    }, 100)
    return () => clearTimeout(timeout)
  }, [depositAmount.isDebouncing, activeFlow.periphery.isLoadingRoute])

  const estimatedAnnualReturn = useMemo(() => {
    if (depositAmount.bn === 0n || vaultAPR === 0) return '0'

    const annualReturn = Number(depositAmount.formValue) * vaultAPR
    return annualReturn.toFixed(2)
  }, [depositAmount.bn, depositAmount.formValue, vaultAPR])

  // Enso returns the expected output in the destination token (vault or staking), we need to convert it to the selected token
  const expectedOutInSelectedToken = useMemo(() => {
    if (
      activeFlow.periphery.expectedOut === 0n ||
      !pricePerShare ||
      !assetToken?.decimals ||
      depositAmount.isDebouncing ||
      depositAmount.bn === 0n
    )
      return 0n
    return (activeFlow.periphery.expectedOut * pricePerShare) / 10n ** BigInt(assetToken.decimals)
  }, [
    activeFlow.periphery.expectedOut,
    assetToken?.decimals,
    pricePerShare,
    depositAmount.isDebouncing,
    depositAmount.bn
  ])

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
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
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
          disabled={isFetchingMaxQuote}
          isMaxButtonLoading={isFetchingMaxQuote}
          onMaxClick={isNativeToken && routeType === 'ENSO' ? fetchMaxQuote : undefined}
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
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">
              {'You will ' + (selectedToken === assetAddress ? 'deposit' : 'swap')}
            </p>
            <p className="text-sm text-text-primary">
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
            <div className="flex items-center justify-between h-5">
              <p className="text-sm text-text-secondary">{'For at least'}</p>
              <p className="text-sm text-text-primary">
                {isLoadingQuote ? (
                  <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
                ) : expectedOutInSelectedToken > 0n ? (
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
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">You will receive</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowVaultSharesModal(true)}
                className="inline-flex items-center justify-center hover:bg-surface-secondary rounded-full p-0.5 transition-colors"
              >
                <svg
                  className="h-3.5 w-3.5 text-text-tertiary hover:text-text-secondary"
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
              <p className="text-sm text-text-primary">
                {isLoadingQuote ? (
                  <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
                ) : depositAmount.bn > 0n && activeFlow.periphery.expectedOut > 0n ? (
                  `${formatAmount(Number(formatUnits(activeFlow.periphery.expectedOut, vault?.decimals ?? 18)))} Vault shares`
                ) : (
                  `0 Vault shares`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">Est. Annual Return</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAnnualReturnModal(true)}
                className="inline-flex items-center justify-center hover:bg-surface-secondary rounded-full p-0.5 transition-colors"
              >
                <svg
                  className="h-3.5 w-3.5 text-text-tertiary hover:text-text-secondary"
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
              <p className="text-sm text-text-primary">
                {depositAmount.bn > 0n ? `~${estimatedAnnualReturn}` : '0'} {inputToken?.symbol}
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
              prepareWrite={activeFlow.actions.prepareApprove}
              transactionName="Approve"
              disabled={!activeFlow.periphery.prepareApproveEnabled || !!depositError}
              tooltip={depositError || undefined}
              loading={isLoadingQuote}
              className="w-full"
              notificationParams={approveNotificationParams}
            />
          )}
          <TxButton
            prepareWrite={activeFlow.actions.prepareDeposit}
            transactionName={
              isLoadingQuote
                ? 'Finding route...'
                : !activeFlow.periphery.isAllowanceSufficient && !isNativeToken
                  ? 'Approve First'
                  : routeType === 'DIRECT_STAKE'
                    ? 'Stake'
                    : activeFlow.periphery.isCrossChain
                      ? 'Cross-chain Deposit'
                      : 'Deposit'
            }
            disabled={!canDeposit}
            loading={isLoadingQuote}
            tooltip={
              depositError ||
              (!activeFlow.periphery.isAllowanceSufficient && !isNativeToken ? 'Please approve token first' : undefined)
            }
            onSuccess={handleDepositSuccess}
            className="w-full"
            notificationParams={depositNotificationParams}
          />
        </div>
      </div>

      {/* Vault Shares Modal */}
      <VaultSharesModal
        isOpen={showVaultSharesModal}
        onClose={() => setShowVaultSharesModal(false)}
        vaultSymbol={vaultSymbol}
        expectedShares={
          activeFlow.periphery.expectedOut > 0n
            ? formatAmount(Number(formatUnits(activeFlow.periphery.expectedOut, vault?.decimals ?? 18)))
            : '0'
        }
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
              setDepositInput('') // Reset the input with no debounce
              setSelectedToken(address)
              setSelectedChainId(chainId)
            }}
            chainId={sourceChainId}
            onClose={() => setShowTokenSelector(false)}
          />
        </div>
      </div>
    </div>
  )
}
