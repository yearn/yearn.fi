import Link from '@components/Link'
import { cl, formatAmount } from '@lib/utils'
import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useInput } from '@nextgen/hooks/useInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useAccount, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'

interface Props {
  vaultAddress: Address
  tokenIn?: Address // Optional, will use vault's asset if not provided
  vaultType: 'v2' | 'v3'
  chainId: number
  destinationChainId?: number // For cross-chain operations
  handleSuccess?: () => void
}

type TabType = 'deposit' | 'withdraw'

const TabButton: FC<{
  className?: string
  children: React.ReactNode
  onClick: () => void
  isActive: boolean
}> = ({ children, onClick, isActive, className }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cl(
        'flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 capitalize',
        isActive
          ? 'bg-white text-gray-900 rounded-bl-none rounded-br-none'
          : 'bg-transparent text-gray-500 hover:text-gray-700',
        className
      )}
    >
      {children}
    </button>
  )
}

export const WidgetEnsoZap: FC<Props> = ({
  vaultAddress,
  tokenIn: providedTokenIn,
  vaultType,
  chainId,
  destinationChainId,
  handleSuccess
}) => {
  const { address: account } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('deposit')
  const [customTokenAddress, setCustomTokenAddress] = useState<string>('')

  // Get asset token from vault
  const { data: assetToken } = useReadContract({
    address: vaultAddress,
    abi: vaultType === 'v2' ? vaultAbi : erc4626Abi,
    functionName: vaultType === 'v2' ? 'token' : 'asset',
    chainId
  })

  // Determine which token to use for deposits
  const depositToken = providedTokenIn || (customTokenAddress as Address) || assetToken
  const tokensToFetch = depositToken ? [depositToken, vaultAddress] : []
  
  const { tokens, refetch: refetchTokens } = useTokens(tokensToFetch, chainId)
  const [inputToken, vault] = tokens

  const depositInput = useInput(inputToken?.decimals ?? 18)
  const withdrawInput = useInput(vault?.decimals ?? 18)
  const [depositAmount] = depositInput
  const [withdrawAmount] = withdrawInput

  // Deposit flow using Enso
  const {
    actions: { prepareApprove: prepareDepositApprove },
    periphery: {
      prepareApproveEnabled: prepareDepositApproveEnabled,
      route: depositRoute,
      isLoadingRoute: isLoadingDepositRoute,
      expectedOut: expectedDepositOut,
      routerAddress: depositRouterAddress,
      isCrossChain
    },
    getRoute: getDepositRoute,
    getEnsoTransaction: getDepositTransaction
  } = useSolverEnso({
    tokenIn: depositToken as Address,
    tokenOut: vaultAddress,
    amountIn: depositAmount.bn,
    fromAddress: account,
    chainId,
    destinationChainId,
    decimalsOut: vault?.decimals ?? 18,
    enabled: !!depositToken && activeTab === 'deposit'
  })

  // Withdraw flow using Enso
  const {
    actions: { prepareApprove: prepareWithdrawApprove },
    periphery: {
      prepareApproveEnabled: prepareWithdrawApproveEnabled,
      route: withdrawRoute,
      isLoadingRoute: isLoadingWithdrawRoute,
      expectedOut: expectedWithdrawOut,
      routerAddress: withdrawRouterAddress
    },
    getRoute: getWithdrawRoute,
    getEnsoTransaction: getWithdrawTransaction
  } = useSolverEnso({
    tokenIn: vaultAddress,
    tokenOut: assetToken as Address,
    amountIn: withdrawAmount.bn,
    fromAddress: account,
    chainId,
    decimalsOut: inputToken?.decimals ?? 18,
    enabled: !!assetToken && activeTab === 'withdraw'
  })

  // Transaction handling for deposit
  const depositTx = getDepositTransaction()
  const {
    sendTransaction: sendDepositTransaction,
    data: depositTxHash,
    isPending: isDepositPending
  } = useSendTransaction()

  const { isLoading: isDepositConfirming } = useWaitForTransactionReceipt({
    hash: depositTxHash,
    chainId,
    query: {
      enabled: !!depositTxHash
    }
  })

  const executeDeposit = useCallback(() => {
    if (!depositTx) return
    sendDepositTransaction({
      to: depositTx.to,
      data: depositTx.data,
      value: BigInt(depositTx.value || 0),
      chainId: depositTx.chainId
    })
  }, [depositTx, sendDepositTransaction])

  // Transaction handling for withdraw
  const withdrawTx = getWithdrawTransaction()
  const {
    sendTransaction: sendWithdrawTransaction,
    data: withdrawTxHash,
    isPending: isWithdrawPending
  } = useSendTransaction()

  const { isLoading: isWithdrawConfirming } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
    chainId,
    query: {
      enabled: !!withdrawTxHash
    }
  })

  const executeWithdraw = useCallback(() => {
    if (!withdrawTx) return
    sendWithdrawTransaction({
      to: withdrawTx.to,
      data: withdrawTx.data,
      value: BigInt(withdrawTx.value || 0),
      chainId: withdrawTx.chainId
    })
  }, [withdrawTx, sendWithdrawTransaction])

  // Fetch routes when amounts change
  useEffect(() => {
    if (activeTab === 'deposit' && depositAmount.bn > 0n) {
      getDepositRoute()
    }
  }, [depositAmount.bn, activeTab, getDepositRoute])

  useEffect(() => {
    if (activeTab === 'withdraw' && withdrawAmount.bn > 0n) {
      getWithdrawRoute()
    }
  }, [withdrawAmount.bn, activeTab, getWithdrawRoute])

  // Success handlers
  const handleDepositSuccess = useCallback(() => {
    refetchTokens()
    handleSuccess?.()
  }, [refetchTokens, handleSuccess])

  const handleWithdrawSuccess = useCallback(() => {
    refetchTokens()
    handleSuccess?.()
  }, [refetchTokens, handleSuccess])

  // Error handling
  const depositError = useMemo(() => {
    if (depositAmount.bn === 0n) return null
    if (depositAmount.bn > (inputToken?.balance.raw || 0n)) {
      return 'Insufficient balance'
    }
    if (!depositRoute && !isLoadingDepositRoute && depositAmount.bn > 0n) {
      return 'Unable to find route'
    }
    return null
  }, [depositAmount.bn, inputToken?.balance.raw, depositRoute, isLoadingDepositRoute])

  const withdrawError = useMemo(() => {
    if (withdrawAmount.bn === 0n) return null
    if (withdrawAmount.bn > (vault?.balance.raw || 0n)) {
      return 'Insufficient balance'
    }
    if (!withdrawRoute && !isLoadingWithdrawRoute && withdrawAmount.bn > 0n) {
      return 'Unable to find route'
    }
    return null
  }, [withdrawAmount.bn, vault?.balance.raw, withdrawRoute, isLoadingWithdrawRoute])

  const canDeposit = depositRoute && !depositError && depositAmount.bn > 0n
  const canWithdraw = withdrawRoute && !withdrawError && withdrawAmount.bn > 0n

  const depositContent = useMemo(
    () => (
      <div className="p-6 pb-0 space-y-4">
        {!providedTokenIn && (
          <div className="space-y-2">
            <label className="text-sm text-gray-600">Custom Token Address (optional)</label>
            <input
              type="text"
              value={customTokenAddress}
              onChange={(e) => setCustomTokenAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              Leave empty to use vault's native token ({assetToken && `${assetToken.slice(0, 6)}...${assetToken.slice(-4)}`})
            </p>
          </div>
        )}

        <InputTokenAmount
          title="Amount to Deposit"
          input={depositInput}
          placeholder="0.00"
          className="flex-1"
          symbol={inputToken?.symbol}
          balance={inputToken?.balance.raw || 0n}
          decimals={inputToken?.decimals}
        />

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">You will receive</span>
            <span className="text-gray-500 font-medium">
              {isLoadingDepositRoute ? (
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
              ) : (
                `${formatAmount(expectedDepositOut.normalized)} ${vault?.symbol}`
              )}
            </span>
          </div>
          {isCrossChain && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Type</span>
              <span className="text-blue-500 font-medium">Cross-chain</span>
            </div>
          )}
          {depositRouterAddress && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Router</span>
              <Link href={`https://etherscan.io/address/${depositRouterAddress}`}>
                <span className="text-gray-500 font-medium hover:underline">
                  {depositRouterAddress.slice(0, 6)}...{depositRouterAddress.slice(-4)}
                </span>
              </Link>
            </div>
          )}
        </div>

        <div className="pb-6 pt-2">
          <div className="flex gap-2">
            <TxButton
              prepareWrite={prepareDepositApprove}
              transactionName="Approve"
              disabled={!prepareDepositApproveEnabled || !!depositError}
              tooltip={depositError || undefined}
              className="w-full"
            />
            <button
              type="button"
              onClick={executeDeposit}
              disabled={!canDeposit || isDepositPending || isDepositConfirming}
              className={cl(
                'w-full px-4 py-2 rounded-md font-medium transition-colors',
                canDeposit && !isDepositPending && !isDepositConfirming
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {isDepositPending || isDepositConfirming
                ? 'Processing...'
                : isLoadingDepositRoute
                ? 'Finding route...'
                : 'Deposit'}
            </button>
          </div>
        </div>
      </div>
    ),
    [
      providedTokenIn,
      customTokenAddress,
      assetToken,
      depositInput,
      inputToken,
      isLoadingDepositRoute,
      expectedDepositOut,
      vault?.symbol,
      isCrossChain,
      depositRouterAddress,
      prepareDepositApprove,
      prepareDepositApproveEnabled,
      depositError,
      executeDeposit,
      canDeposit,
      isDepositPending,
      isDepositConfirming
    ]
  )

  const withdrawContent = useMemo(
    () => (
      <div className="pt-6 px-6 pb-6 space-y-4">
        <InputTokenAmount
          title="Amount to Withdraw"
          input={withdrawInput}
          placeholder="0.00"
          className="flex-1"
          symbol={vault?.symbol}
          balance={vault?.balance.raw || 0n}
          decimals={vault?.decimals}
        />

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">You will receive</span>
            <span className="text-gray-500 font-medium">
              {isLoadingWithdrawRoute ? (
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
              ) : (
                `${formatAmount(expectedWithdrawOut.normalized)} ${inputToken?.symbol || 'tokens'}`
              )}
            </span>
          </div>
          {withdrawRouterAddress && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Router</span>
              <Link href={`https://etherscan.io/address/${withdrawRouterAddress}`}>
                <span className="text-gray-500 font-medium hover:underline">
                  {withdrawRouterAddress.slice(0, 6)}...{withdrawRouterAddress.slice(-4)}
                </span>
              </Link>
            </div>
          )}
        </div>

        <div className="pt-2">
          <div className="flex gap-2">
            <TxButton
              prepareWrite={prepareWithdrawApprove}
              transactionName="Approve"
              disabled={!prepareWithdrawApproveEnabled || !!withdrawError}
              tooltip={withdrawError || undefined}
              className="w-full"
            />
            <button
              type="button"
              onClick={executeWithdraw}
              disabled={!canWithdraw || isWithdrawPending || isWithdrawConfirming}
              className={cl(
                'w-full px-4 py-2 rounded-md font-medium transition-colors',
                canWithdraw && !isWithdrawPending && !isWithdrawConfirming
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {isWithdrawPending || isWithdrawConfirming
                ? 'Processing...'
                : isLoadingWithdrawRoute
                ? 'Finding route...'
                : 'Withdraw'}
            </button>
          </div>
        </div>
      </div>
    ),
    [
      withdrawInput,
      vault,
      isLoadingWithdrawRoute,
      expectedWithdrawOut,
      inputToken?.symbol,
      withdrawRouterAddress,
      prepareWithdrawApprove,
      prepareWithdrawApproveEnabled,
      withdrawError,
      executeWithdraw,
      canWithdraw,
      isWithdrawPending,
      isWithdrawConfirming
    ]
  )

  return (
    <div className="flex flex-col gap-0 mt-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-100 rounded-lg flex h-12">
          <TabButton isActive={activeTab === 'deposit'} onClick={() => setActiveTab('deposit')}>
            {isCrossChain ? 'Cross-chain Deposit' : 'Zap In'}
          </TabButton>
          <TabButton isActive={activeTab === 'withdraw'} onClick={() => setActiveTab('withdraw')}>
            Zap Out
          </TabButton>
        </div>
        {activeTab === 'deposit' ? depositContent : withdrawContent}
      </div>
    </div>
  )
}