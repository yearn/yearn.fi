import { InputTokenAmount } from '@pages/vaults/components/widget/InputTokenAmount'
import { useDebouncedInput } from '@pages/vaults/hooks/useDebouncedInput'
import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { formatTAmount, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import { type FC, useCallback, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { SettingsPopover } from '../SettingsPopover'
import { TokenSelectorOverlay } from '../shared/TokenSelectorOverlay'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { AnnualReturnOverlay } from './AnnualReturnOverlay'
import { ApprovalOverlay } from './ApprovalOverlay'
import { DepositDetails } from './DepositDetails'
import { useDepositError } from './useDepositError'
import { useDepositFlow } from './useDepositFlow'
import { useDepositNotifications } from './useDepositNotifications'
import { useFetchMaxQuote } from './useFetchMaxQuote'
import { VaultSharesOverlay } from './VaultSharesOverlay'
import { VaultShareValueOverlay } from './VaultShareValueOverlay'

interface Props {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  stakingAddress?: `0x${string}`
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
  const [selectedToken, setSelectedToken] = useState<`0x${string}` | undefined>(assetAddress)
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>()
  const [showVaultSharesModal, setShowVaultSharesModal] = useState(false)
  const [showVaultShareValueModal, setShowVaultShareValueModal] = useState(false)
  const [showAnnualReturnModal, setShowAnnualReturnModal] = useState(false)
  const [showApprovalOverlay, setShowApprovalOverlay] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)

  // ============================================================================
  // Token Data (shared with VaultDetailsHeader via cache)
  // ============================================================================
  const {
    assetToken,
    vaultToken: vault,
    stakingToken,
    pricePerShare,
    isLoading: isLoadingVaultData,
    refetch: refetchVaultUserData
  } = useVaultUserData({
    vaultAddress,
    assetAddress,
    stakingAddress,
    chainId,
    account
  })

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
  // Notifications
  // ============================================================================
  const isCrossChain = sourceChainId !== chainId
  const { approveNotificationParams, depositNotificationParams } = useDepositNotifications({
    inputToken,
    vault,
    stakingToken,
    depositToken,
    assetAddress,
    destinationToken,
    stakingAddress,
    account,
    sourceChainId,
    chainId,
    depositAmount: depositAmount.debouncedBn,
    routeType,
    routerAddress: activeFlow.periphery.routerAddress,
    isCrossChain
  })

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

  // ============================================================================
  // Computed Values
  // ============================================================================
  const willReceiveStakedShares = routeType === 'DIRECT_STAKE' || (isAutoStakingEnabled && !!stakingAddress)
  const sharesDecimals = willReceiveStakedShares
    ? (stakingToken?.decimals ?? vault?.decimals ?? 18)
    : (vault?.decimals ?? 18)
  const vaultDecimals = vault?.decimals ?? 18

  const estimatedAnnualReturn = useMemo(() => {
    if (depositAmount.debouncedBn === 0n || vaultAPR === 0) return '0'
    const annualReturn = Number(formatUnits(depositAmount.debouncedBn, inputToken?.decimals ?? 18)) * vaultAPR
    return annualReturn.toFixed(2)
  }, [depositAmount.debouncedBn, inputToken?.decimals, vaultAPR])

  const expectedOutInAsset = useMemo(() => {
    if (activeFlow.periphery.expectedOut === 0n || !pricePerShare || depositAmount.bn === 0n) return 0n
    return (activeFlow.periphery.expectedOut * pricePerShare) / 10n ** BigInt(vaultDecimals)
  }, [activeFlow.periphery.expectedOut, vaultDecimals, pricePerShare, depositAmount.bn])

  const inputTokenPrice =
    inputToken?.address && inputToken?.chainID
      ? getPrice({ address: toAddress(inputToken.address), chainID: inputToken.chainID }).normalized
      : 0

  const outputTokenPrice =
    depositToken !== assetAddress && assetToken?.address && assetToken?.chainID
      ? getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
      : 0

  const assetTokenPrice =
    assetToken?.address && assetToken?.chainID
      ? getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID }).normalized
      : 0

  const vaultShareValue = useMemo(() => {
    const expectedOut = activeFlow.periphery.expectedOut
    const assetDecimals = assetToken?.decimals ?? 18

    // Use vault decimals for pricePerShare calculation
    const valueInAsset =
      expectedOut > 0n && pricePerShare && pricePerShare > 0n
        ? (expectedOut * pricePerShare) / 10n ** BigInt(vaultDecimals)
        : 0n

    const formatted = formatTAmount({
      value: valueInAsset,
      decimals: assetDecimals,
      options: { maximumFractionDigits: 6 }
    })

    const usd = (Number(formatUnits(valueInAsset, assetDecimals)) * assetTokenPrice).toFixed(2)

    return { formatted, usd }
  }, [activeFlow.periphery.expectedOut, vaultDecimals, assetToken?.decimals, pricePerShare, assetTokenPrice])

  // ============================================================================
  // Transaction Step Configuration
  // ============================================================================
  const formattedDepositAmount = formatTAmount({ value: depositAmount.bn, decimals: inputToken?.decimals ?? 18 })
  const needsApproval = !isNativeToken && !activeFlow.periphery.isAllowanceSufficient

  const currentStep: TransactionStep | undefined = useMemo(() => {
    if (needsApproval) {
      return {
        prepare: activeFlow.actions.prepareApprove,
        label: 'Approve',
        confirmMessage: `Approving ${formattedDepositAmount} ${inputToken?.symbol || ''}`,
        successTitle: 'Approval successful',
        successMessage: `Approved ${formattedDepositAmount} ${inputToken?.symbol || ''}.\nReady to deposit.`,
        notification: approveNotificationParams
      }
    }

    const actionVerb = routeType === 'DIRECT_STAKE' ? 'Stake' : 'Deposit'
    const actionVerbPast = routeType === 'DIRECT_STAKE' ? 'staked' : 'deposited'

    if (isCrossChain) {
      return {
        prepare: activeFlow.actions.prepareDeposit,
        label: actionVerb,
        confirmMessage: `${routeType === 'DIRECT_STAKE' ? 'Staking' : 'Depositing'} ${formattedDepositAmount} ${inputToken?.symbol || ''}`,
        successTitle: 'Transaction Submitted',
        successMessage: `Your cross-chain ${actionVerb.toLowerCase()} has been submitted.\nIt may take a few minutes to complete on the destination chain.`,
        showConfetti: true,
        notification: depositNotificationParams
      }
    }

    return {
      prepare: activeFlow.actions.prepareDeposit,
      label: actionVerb,
      confirmMessage: `${routeType === 'DIRECT_STAKE' ? 'Staking' : 'Depositing'} ${formattedDepositAmount} ${inputToken?.symbol || ''}`,
      successTitle: `${actionVerb} successful!`,
      successMessage: `You have ${actionVerbPast} ${formattedDepositAmount} ${inputToken?.symbol || ''} into ${vaultSymbol}.`,
      showConfetti: true,
      notification: depositNotificationParams
    }
  }, [
    needsApproval,
    activeFlow.actions.prepareApprove,
    activeFlow.actions.prepareDeposit,
    formattedDepositAmount,
    inputToken?.symbol,
    vaultSymbol,
    routeType,
    approveNotificationParams,
    depositNotificationParams,
    isCrossChain
  ])

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
    refetchVaultUserData()
    onDepositSuccess?.()
  }, [
    setDepositInput,
    refreshWalletBalances,
    depositToken,
    sourceChainId,
    vaultAddress,
    chainId,
    stakingAddress,
    refetchVaultUserData,
    onDepositSuccess
  ])

  const handleTokenChange = useCallback(
    (address: `0x${string}`, tokenChainId?: number) => {
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
  if (isLoadingVaultData) {
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
      <div className="flex justify-end md:opacity-0 md:group-hover/widget:opacity-100 transition-opacity duration-200 h-7">
        <SettingsPopover
          slippage={zapSlippage}
          setSlippage={setZapSlippage}
          maximizeYield={isAutoStakingEnabled}
          setMaximizeYield={setIsAutoStakingEnabled}
        />
      </div>

      {/* Amount Section */}
      <div className="px-6 pb-6">
        <InputTokenAmount
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
        routeType={routeType}
        isSwap={selectedToken !== assetAddress}
        isLoadingQuote={activeFlow.periphery.isLoadingRoute}
        expectedOutInAsset={expectedOutInAsset}
        assetTokenSymbol={assetToken?.symbol}
        assetTokenDecimals={assetToken?.decimals ?? 18}
        expectedVaultShares={activeFlow.periphery.expectedOut}
        vaultDecimals={vaultDecimals}
        sharesDisplayDecimals={sharesDecimals}
        pricePerShare={pricePerShare || 0n}
        assetUsdPrice={assetTokenPrice}
        willReceiveStakedShares={willReceiveStakedShares}
        onShowVaultSharesModal={() => setShowVaultSharesModal(true)}
        onShowVaultShareValueModal={() => setShowVaultShareValueModal(true)}
        estimatedAnnualReturn={estimatedAnnualReturn}
        onShowAnnualReturnModal={() => setShowAnnualReturnModal(true)}
        allowance={!isNativeToken ? activeFlow.periphery.allowance : undefined}
        allowanceTokenDecimals={!isNativeToken ? (inputToken?.decimals ?? 18) : undefined}
        allowanceTokenSymbol={!isNativeToken ? inputToken?.symbol : undefined}
        approvalSpenderName={!isNativeToken ? (routeType === 'ENSO' ? 'Enso' : 'Vault') : undefined}
        onAllowanceClick={
          !isNativeToken && activeFlow.periphery.allowance > 0n
            ? () => setDepositInput(formatUnits(activeFlow.periphery.allowance, inputToken?.decimals ?? 18))
            : undefined
        }
        onShowApprovalOverlay={!isNativeToken ? () => setShowApprovalOverlay(true) : undefined}
      />

      {/* Action Button */}
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
          <Button
            onClick={() => setShowTransactionOverlay(true)}
            variant={activeFlow.periphery.isLoadingRoute ? 'busy' : 'filled'}
            isBusy={activeFlow.periphery.isLoadingRoute}
            disabled={
              !!depositError ||
              depositAmount.bn === 0n ||
              activeFlow.periphery.isLoadingRoute ||
              depositAmount.isDebouncing ||
              (!activeFlow.periphery.isAllowanceSufficient && !activeFlow.periphery.prepareApproveEnabled) ||
              (activeFlow.periphery.isAllowanceSufficient && !activeFlow.periphery.prepareDepositEnabled)
            }
            className="w-full"
            classNameOverride="yearn--button--nextgen w-full"
          >
            {activeFlow.periphery.isLoadingRoute
              ? 'Fetching quote'
              : !isNativeToken && !activeFlow.periphery.isAllowanceSufficient
                ? `Approve & ${routeType === 'DIRECT_STAKE' ? 'Stake' : 'Deposit'}`
                : routeType === 'DIRECT_STAKE'
                  ? 'Stake'
                  : 'Deposit'}
          </Button>
        )}
      </div>

      {/* Transaction Overlay */}
      <TransactionOverlay
        isOpen={showTransactionOverlay}
        onClose={() => setShowTransactionOverlay(false)}
        step={currentStep}
        isLastStep={!needsApproval}
        onAllComplete={handleDepositSuccess}
      />

      {/* Modals */}
      <VaultSharesOverlay
        isOpen={showVaultSharesModal}
        onClose={() => setShowVaultSharesModal(false)}
        depositTokenSymbol={inputToken?.symbol || ''}
        vaultAssetSymbol={assetToken?.symbol || ''}
        vaultSymbol={vaultSymbol}
        stakingTokenSymbol={stakingToken?.symbol}
        expectedShares={
          activeFlow.periphery.expectedOut > 0n
            ? formatTAmount({
                value: activeFlow.periphery.expectedOut,
                decimals: sharesDecimals
              })
            : '0'
        }
        stakingAddress={stakingAddress}
        isAutoStakingEnabled={isAutoStakingEnabled}
        isZap={routeType === 'ENSO' && selectedToken !== assetAddress}
        routeType={routeType}
      />

      <AnnualReturnOverlay
        isOpen={showAnnualReturnModal}
        onClose={() => setShowAnnualReturnModal(false)}
        depositAmount={formatTAmount({
          value: depositAmount.debouncedBn,
          decimals: inputToken?.decimals ?? 18
        })}
        tokenSymbol={inputToken?.symbol}
        estimatedReturn={estimatedAnnualReturn}
        currentAPR={vaultAPR}
      />

      <VaultShareValueOverlay
        isOpen={showVaultShareValueModal}
        onClose={() => setShowVaultShareValueModal(false)}
        sharesAmount={formatTAmount({
          value: activeFlow.periphery.expectedOut,
          decimals: sharesDecimals,
          options: { maximumFractionDigits: 4 }
        })}
        shareValue={vaultShareValue.formatted}
        assetSymbol={assetToken?.symbol || ''}
        usdValue={vaultShareValue.usd}
      />

      <ApprovalOverlay
        isOpen={showApprovalOverlay}
        onClose={() => setShowApprovalOverlay(false)}
        tokenSymbol={inputToken?.symbol || ''}
        tokenAddress={toAddress(depositToken)}
        tokenDecimals={inputToken?.decimals ?? 18}
        spenderAddress={toAddress(
          routeType === 'ENSO'
            ? activeFlow.periphery.routerAddress || destinationToken
            : routeType === 'DIRECT_STAKE'
              ? stakingAddress || destinationToken
              : destinationToken
        )}
        spenderName={routeType === 'ENSO' ? 'Enso Router' : 'Vault'}
        chainId={sourceChainId}
        currentAllowance={
          activeFlow.periphery.allowance >= BigInt(2) ** BigInt(255)
            ? 'Unlimited'
            : formatTAmount({ value: activeFlow.periphery.allowance, decimals: inputToken?.decimals ?? 18 })
        }
      />

      {/* Token Selector Overlay */}
      <TokenSelectorOverlay
        isOpen={showTokenSelector}
        onClose={() => setShowTokenSelector(false)}
        onChange={handleTokenChange}
        chainId={sourceChainId}
        value={selectedToken}
        priorityTokens={{ [chainId]: [assetAddress] }}
        excludeTokens={stakingAddress ? [stakingAddress] : undefined}
        assetAddress={assetAddress}
        vaultAddress={vaultAddress}
        stakingAddress={stakingAddress}
      />
    </div>
  )
}
