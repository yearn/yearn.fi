import { Button } from '@lib/components/Button'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import type { TCreateNotificationParams } from '@lib/types/notifications'
import { formatTAmount, toAddress } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import { InputTokenAmountV2 } from '@nextgen/components/InputTokenAmountV2'
import { TxButton } from '@nextgen/components/TxButton'
import { useDirectDeposit } from '@nextgen/hooks/actions/useDirectDeposit'
import { useDirectStake } from '@nextgen/hooks/actions/useDirectStake'
import { useEnsoDeposit } from '@nextgen/hooks/actions/useEnsoDeposit'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useCallback, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { SettingsPopover } from '../SettingsPopover'
import { TokenSelectorOverlay, useLoadingQuote } from '../shared'
import { AnnualReturnModal } from './AnnualReturnModal'
import { DepositDetails } from './DepositDetails'
import { useDepositRoute } from './useDepositRoute'
import { VaultSharesModal } from './VaultSharesModal'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  stakingAddress?: Address
  chainId: number
  vaultAPR: number
  vaultSymbol: string
  stakingSource?: string
  handleDepositSuccess?: () => void
}

export const WidgetDeposit: FC<Props> = ({
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
  const { openLoginModal } = useWeb3()
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled, getPrice } = useYearn()

  // ============================================================================
  // UI State
  // ============================================================================
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showVaultSharesModal, setShowVaultSharesModal] = useState(false)
  const [showAnnualReturnModal, setShowAnnualReturnModal] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [isFetchingMaxQuote, setIsFetchingMaxQuote] = useState(false)

  // ============================================================================
  // Token Data
  // ============================================================================
  const priorityTokenAddresses = useMemo(() => {
    const addresses: (Address | undefined)[] = [assetAddress, vaultAddress]
    if (stakingAddress) addresses.push(stakingAddress)
    return addresses
  }, [assetAddress, vaultAddress, stakingAddress])

  const {
    tokens: priorityTokens,
    isLoading: isLoadingPriorityTokens,
    refetch: refetchPriorityTokens
  } = useTokens(priorityTokenAddresses, chainId, account)

  const [assetToken, vault, stakingToken] = priorityTokens

  // Derived token values
  const depositToken = selectedToken || assetAddress
  const sourceChainId = selectedChainId || chainId
  const isNativeToken = toAddress(depositToken) === toAddress(ETH_TOKEN_ADDRESS)

  const inputToken = useMemo(() => {
    if (sourceChainId === chainId && depositToken === assetAddress) {
      return assetToken
    }
    return getToken({ address: depositToken, chainID: sourceChainId })
  }, [getToken, depositToken, sourceChainId, chainId, assetAddress, assetToken])

  const destinationToken = useMemo(() => {
    if (isAutoStakingEnabled && stakingAddress) return stakingAddress
    return vaultAddress
  }, [isAutoStakingEnabled, stakingAddress, vaultAddress])

  // ============================================================================
  // Input Handling
  // ============================================================================
  const depositInput = useDebouncedInput(inputToken?.decimals ?? 18)
  const [depositAmount, , setDepositInput] = depositInput

  // ============================================================================
  // Contract Reads
  // ============================================================================
  const { data: pricePerShare } = useReadContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'pricePerShare',
    chainId
  })

  // ============================================================================
  // Routing & Flows
  // ============================================================================
  const routeType = useDepositRoute({
    depositToken,
    assetAddress,
    destinationToken,
    vaultAddress,
    stakingAddress
  })

  const directDeposit = useDirectDeposit({
    vaultAddress,
    assetAddress,
    amount: depositAmount.debouncedBn,
    account,
    chainId,
    decimals: inputToken?.decimals ?? 18,
    enabled: routeType === 'DIRECT_DEPOSIT' && depositAmount.debouncedBn > 0n
  })

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

  const ensoFlow = useEnsoDeposit({
    vaultAddress: destinationToken,
    depositToken,
    amount: depositAmount.debouncedBn,
    account,
    chainId: sourceChainId,
    destinationChainId: vault?.chainID,
    decimalsOut: vault?.decimals ?? 18,
    enabled: routeType === 'ENSO' && !!depositToken && depositAmount.debouncedBn > 0n && depositAmount.bn > 0n,
    slippage: zapSlippage * 100
  })

  const activeFlow = useMemo(() => {
    if (routeType === 'DIRECT_DEPOSIT') return directDeposit
    if (routeType === 'DIRECT_STAKE') return directStake
    return ensoFlow
  }, [routeType, directDeposit, directStake, ensoFlow])

  // ============================================================================
  // Loading State
  // ============================================================================
  const isLoadingQuote = useLoadingQuote(depositAmount.isDebouncing, activeFlow.periphery.isLoadingRoute)

  // ============================================================================
  // Error Handling
  // ============================================================================
  const depositError = useMemo(() => {
    if (depositAmount.bn === 0n || activeFlow.periphery.isLoadingRoute) return null
    if (depositAmount.bn > (inputToken?.balance.raw || 0n)) return 'Insufficient balance'
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

  const canDeposit =
    activeFlow.periphery.prepareDepositEnabled &&
    activeFlow.periphery.isAllowanceSufficient &&
    !depositError &&
    depositAmount.bn > 0n

  // ============================================================================
  // Notifications
  // ============================================================================
  const approveNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!inputToken || !vault || !account) return undefined
    if (routeType === 'DIRECT_DEPOSIT') return undefined

    let spenderAddress: Address
    let spenderName: string

    if (routeType === 'ENSO') {
      spenderAddress = (activeFlow.periphery.routerAddress as Address) || destinationToken
      spenderName = activeFlow.periphery.routerAddress ? 'Enso Router' : vault.symbol || ''
    } else if (routeType === 'DIRECT_STAKE') {
      spenderAddress = stakingAddress || destinationToken
      spenderName = 'Staking Contract'
    } else {
      return undefined
    }

    return {
      type: 'approve',
      amount: formatTAmount({ value: inputToken.balance.raw, decimals: inputToken.decimals ?? 18 }),
      fromAddress: toAddress(depositToken),
      fromSymbol: inputToken.symbol || '',
      fromChainId: sourceChainId,
      toAddress: toAddress(spenderAddress),
      toSymbol: spenderName
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
    stakingAddress
  ])

  const depositNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!inputToken || !vault || !account || depositAmount.bn === 0n) return undefined

    let notificationType: 'deposit' | 'zap' | 'crosschain zap' | 'stake' = 'deposit'
    if (routeType === 'ENSO') {
      notificationType = activeFlow.periphery.isCrossChain ? 'crosschain zap' : 'zap'
    } else if (routeType === 'DIRECT_STAKE') {
      notificationType = 'stake'
    }

    const destinationTokenSymbol =
      routeType === 'DIRECT_STAKE' && stakingToken ? stakingToken.symbol || vault.symbol || '' : vault.symbol || ''

    return {
      type: notificationType,
      amount: formatTAmount({ value: depositAmount.bn, decimals: inputToken.decimals ?? 18 }),
      fromAddress: toAddress(depositToken),
      fromSymbol: inputToken.symbol || '',
      fromChainId: sourceChainId,
      toAddress: toAddress(destinationToken),
      toSymbol: destinationTokenSymbol,
      toChainId: activeFlow.periphery.isCrossChain ? chainId : undefined
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

  // ============================================================================
  // Computed Values
  // ============================================================================
  const estimatedAnnualReturn = useMemo(() => {
    if (depositAmount.bn === 0n || vaultAPR === 0) return '0'
    const annualReturn = Number(depositAmount.formValue) * vaultAPR
    return annualReturn.toFixed(2)
  }, [depositAmount.bn, depositAmount.formValue, vaultAPR])

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

  const inputTokenPrice = useMemo(() => {
    if (!inputToken?.address || !inputToken?.chainID) return 0
    return getPrice({ address: toAddress(inputToken.address), chainID: inputToken.chainID }).normalized
  }, [inputToken?.address, inputToken?.chainID, getPrice])

  const outputTokenPrice = useMemo(() => {
    if (depositToken === assetAddress) return 0
    if (!assetToken?.address || !assetToken?.chainID) return 0
    return getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
  }, [depositToken, assetAddress, assetToken?.address, assetToken?.chainID, getPrice])

  // ============================================================================
  // Handlers
  // ============================================================================
  const handleDepositSuccess = useCallback(() => {
    setDepositInput('')
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

  const handleTokenChange = useCallback(
    (address: Address, tokenChainId?: number) => {
      setDepositInput('')
      setSelectedToken(address)
      setSelectedChainId(tokenChainId)
      setShowTokenSelector(false)
    },
    [setDepositInput]
  )

  const fetchMaxQuote = useCallback(async () => {
    if (!isNativeToken || !account || !inputToken?.balance.raw || !depositToken) return

    setIsFetchingMaxQuote(true)
    try {
      const ENSO_API_BASE = 'https://api.enso.finance/api/v1'
      const ENSO_API_KEY = import.meta.env.VITE_ENSO_API_KEY

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
      <div className="flex justify-end px-1 py-1 h-6 opacity-0 group-hover/widget:opacity-100 transition-opacity duration-200">
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
      <DepositDetails
        depositAmountBn={depositAmount.bn}
        inputTokenSymbol={inputToken?.symbol}
        inputTokenDecimals={inputToken?.decimals ?? 18}
        isSwap={selectedToken !== assetAddress}
        isLoadingQuote={isLoadingQuote}
        expectedOutInAsset={expectedOutInSelectedToken}
        assetTokenSymbol={assetToken?.symbol}
        assetTokenDecimals={assetToken?.decimals ?? 18}
        expectedVaultShares={activeFlow.periphery.expectedOut}
        vaultDecimals={vault?.decimals ?? 18}
        onShowVaultSharesModal={() => setShowVaultSharesModal(true)}
        estimatedAnnualReturn={estimatedAnnualReturn}
        onShowAnnualReturnModal={() => setShowAnnualReturnModal(true)}
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
            {!isNativeToken && (
              <TxButton
                prepareWrite={activeFlow.actions.prepareApprove}
                transactionName="Approve"
                disabled={!activeFlow.periphery.prepareApproveEnabled || !!depositError}
                loading={isLoadingQuote}
                className="w-full"
                notification={approveNotificationParams}
              />
            )}
            <TxButton
              prepareWrite={activeFlow.actions.prepareDeposit}
              transactionName={
                isLoadingQuote
                  ? 'Finding route...'
                  : !activeFlow.periphery.isAllowanceSufficient && !isNativeToken
                    ? 'Deposit'
                    : routeType === 'DIRECT_STAKE'
                      ? 'Stake'
                      : 'Deposit'
              }
              disabled={!canDeposit}
              loading={isLoadingQuote}
              onSuccess={handleDepositSuccess}
              className="w-full"
              notification={depositNotificationParams}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <VaultSharesModal
        isOpen={showVaultSharesModal}
        onClose={() => setShowVaultSharesModal(false)}
        vaultSymbol={vaultSymbol}
        expectedShares={
          activeFlow.periphery.expectedOut > 0n
            ? formatTAmount({ value: activeFlow.periphery.expectedOut, decimals: vault?.decimals ?? 18 })
            : '0'
        }
        stakingAddress={stakingAddress}
        isAutoStakingEnabled={isAutoStakingEnabled}
      />

      <AnnualReturnModal
        isOpen={showAnnualReturnModal}
        onClose={() => setShowAnnualReturnModal(false)}
        depositAmount={formatTAmount({ value: depositAmount.debouncedBn, decimals: inputToken?.decimals ?? 18 })}
        tokenSymbol={inputToken?.symbol}
        estimatedReturn={estimatedAnnualReturn}
        currentAPR={vaultAPR}
      />

      {/* Token Selector Overlay */}
      <TokenSelectorOverlay
        isOpen={showTokenSelector}
        onClose={() => setShowTokenSelector(false)}
        onChange={handleTokenChange}
        chainId={sourceChainId}
        value={selectedToken}
      />
    </div>
  )
}

// Re-export types
export type {
  DepositWidgetProps,
  DepositRouteType,
  DepositFlow,
  DepositFlowActions,
  DepositFlowPeriphery,
  DepositState
} from './types'
