import { Button } from '@lib/components/Button'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { formatTAmount, toAddress } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import { InputTokenAmountV2 } from '@nextgen/components/InputTokenAmountV2'
import { TxButton } from '@nextgen/components/TxButton'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useCallback, useMemo, useState } from 'react'
import { type Address, formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { SettingsPopover } from '../SettingsPopover'
import { TokenSelectorOverlay } from '../shared'
import { AnnualReturnModal } from './AnnualReturnModal'
import { DepositDetails } from './DepositDetails'
import { useDepositError } from './useDepositError'
import { useDepositFlow } from './useDepositFlow'
import { useDepositNotifications } from './useDepositNotifications'
import { useFetchMaxQuote } from './useFetchMaxQuote'
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
  // Deposit Flow (routing, actions, periphery)
  // ============================================================================
  const { routeType, activeFlow } = useDepositFlow({
    depositToken,
    assetAddress,
    destinationToken,
    vaultAddress,
    stakingAddress,
    amount: depositAmount.debouncedBn,
    currentAmount: depositAmount.bn,
    account,
    chainId,
    sourceChainId,
    destinationChainId: vault?.chainID,
    inputDecimals: inputToken?.decimals ?? 18,
    vaultDecimals: vault?.decimals ?? 18,
    slippage: zapSlippage,
    stakingSource
  })

  // ============================================================================
  // Loading State
  // ============================================================================
  // const isLoadingQuote = useLoadingQuote(depositAmount.isDebouncing, activeFlow.periphery.isLoadingRoute)

  // ============================================================================
  // Error Handling
  // ============================================================================
  const depositError = useDepositError({
    amount: depositAmount.bn,
    debouncedAmount: depositAmount.debouncedBn,
    isDebouncing: depositAmount.isDebouncing,
    balance: inputToken?.balance.raw || 0n,
    account,
    isLoadingRoute: activeFlow.periphery.isLoadingRoute,
    flowError: activeFlow.periphery.error,
    selectedToken,
    vaultAddress,
    isAutoStakingEnabled
  })

  const canDeposit =
    activeFlow.periphery.prepareDepositEnabled &&
    activeFlow.periphery.isAllowanceSufficient &&
    !depositError &&
    depositAmount.bn > 0n

  // ============================================================================
  // Notifications
  // ============================================================================
  const { approveNotificationParams, depositNotificationParams } = useDepositNotifications({
    inputToken,
    vault,
    stakingToken,
    depositToken,
    destinationToken,
    stakingAddress,
    account,
    sourceChainId,
    chainId,
    depositAmount: depositAmount.bn,
    routeType,
    routerAddress: activeFlow.periphery.routerAddress,
    isCrossChain: activeFlow.periphery.isCrossChain
  })

  // ============================================================================
  // Computed Values
  // ============================================================================
  const estimatedAnnualReturn = useMemo(() => {
    if (depositAmount.debouncedBn === 0n || vaultAPR === 0) return '0'
    const annualReturn = Number(formatUnits(depositAmount.debouncedBn, inputToken?.decimals ?? 18)) * vaultAPR
    return annualReturn.toFixed(2)
  }, [depositAmount.debouncedBn, inputToken?.decimals, vaultAPR])

  const expectedOutInSelectedToken = useMemo(() => {
    if (activeFlow.periphery.expectedOut === 0n || !pricePerShare || !assetToken?.decimals || depositAmount.bn === 0n)
      return 0n
    return (activeFlow.periphery.expectedOut * pricePerShare) / 10n ** BigInt(assetToken.decimals)
  }, [activeFlow.periphery.expectedOut, assetToken?.decimals, pricePerShare, depositAmount.bn])

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
  // Max Quote (for native tokens)
  // ============================================================================
  const { fetchMaxQuote, isFetching: isFetchingMaxQuote } = useFetchMaxQuote({
    isNativeToken,
    account,
    balance: inputToken?.balance.raw,
    decimals: inputToken?.decimals ?? 18,
    depositToken,
    destinationToken,
    sourceChainId,
    chainId,
    slippage: zapSlippage,
    onResult: setDepositInput
  })

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
        isLoadingQuote={activeFlow.periphery.isLoadingRoute}
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
                disabled={
                  !activeFlow.periphery.prepareApproveEnabled ||
                  !!depositError ||
                  activeFlow.periphery.isLoadingRoute ||
                  depositAmount.isDebouncing
                }
                className="w-full"
                notification={approveNotificationParams}
              />
            )}
            <TxButton
              prepareWrite={activeFlow.actions.prepareDeposit}
              transactionName={
                activeFlow.periphery.isLoadingRoute
                  ? 'Fetching quote'
                  : !activeFlow.periphery.isAllowanceSufficient && !isNativeToken
                    ? 'Deposit'
                    : routeType === 'DIRECT_STAKE'
                      ? 'Stake'
                      : 'Deposit'
              }
              disabled={!canDeposit}
              loading={activeFlow.periphery.isLoadingRoute}
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
  DepositFlow,
  DepositFlowActions,
  DepositFlowPeriphery,
  DepositRouteType,
  DepositState,
  DepositWidgetProps
} from './types'
