import Link from '@components/Link'
import { cl, formatAmount } from '@lib/utils'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  tokenIn?: Address // Optional custom token to zap from
  chainId: number
  destinationChainId?: number // For cross-chain operations
  handleDepositSuccess?: () => void
}

export const WidgetEnsoDeposit: FC<Props> = ({
  vaultAddress,
  assetAddress,
  tokenIn: providedTokenIn,
  chainId,
  destinationChainId,
  handleDepositSuccess
}) => {
  const { address: account } = useAccount()
  const [customTokenAddress, setCustomTokenAddress] = useState<string>('')

  // Determine which token to use for deposits
  const depositToken = providedTokenIn || (customTokenAddress as Address) || assetAddress
  const { tokens, refetch: refetchTokens } = useTokens([depositToken, vaultAddress], chainId)
  const [inputToken, vault] = tokens

  const depositInput = useDebouncedInput(inputToken?.decimals ?? 18)
  const [depositAmount] = depositInput

  // Deposit flow using Enso
  const {
    actions: { prepareApprove },
    periphery: {
      prepareApproveEnabled,
      route,
      isLoadingRoute,
      expectedOut,
      routerAddress,
      isCrossChain
    },
    getRoute,
    getEnsoTransaction
  } = useSolverEnso({
    tokenIn: depositToken,
    tokenOut: vaultAddress,
    amountIn: depositAmount.debouncedBn,
    fromAddress: account,
    chainId,
    destinationChainId,
    decimalsOut: vault?.decimals ?? 18,
    enabled: !!depositToken && !depositAmount.isDebouncing
  })

  // Transaction handling
  const ensoTx = getEnsoTransaction()
  const {
    sendTransaction,
    data: txHash,
    isPending
  } = useSendTransaction()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
    query: {
      enabled: !!txHash
    }
  })

  const executeDeposit = useCallback(() => {
    if (!ensoTx) return
    sendTransaction({
      to: ensoTx.to,
      data: ensoTx.data,
      value: BigInt(ensoTx.value || 0),
      chainId: ensoTx.chainId
    })
  }, [ensoTx, sendTransaction])

  // Fetch route when debounced amount changes
  useEffect(() => {
    if (depositAmount.debouncedBn > 0n && !depositAmount.isDebouncing) {
      getRoute()
    }
  }, [depositAmount.debouncedBn, depositAmount.isDebouncing, getRoute])

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      refetchTokens()
      handleDepositSuccess?.()
    }
  }, [isSuccess, refetchTokens, handleDepositSuccess])

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
  }, [depositAmount.bn, depositAmount.debouncedBn, depositAmount.isDebouncing, inputToken?.balance.raw, route, isLoadingRoute])

  const canDeposit = route && !depositError && depositAmount.bn > 0n

  return (
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
            Leave empty to use vault's native token ({assetAddress && `${assetAddress.slice(0, 6)}...${assetAddress.slice(-4)}`})
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
            {isLoadingRoute || depositAmount.isDebouncing ? (
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              `${formatAmount(expectedOut.normalized)} ${vault?.symbol}`
            )}
          </span>
        </div>
        {isCrossChain && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Type</span>
            <span className="text-blue-500 font-medium">Cross-chain</span>
          </div>
        )}
        {routerAddress && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Router</span>
            <Link href={`https://etherscan.io/address/${routerAddress}`}>
              <span className="text-gray-500 font-medium hover:underline">
                {routerAddress.slice(0, 6)}...{routerAddress.slice(-4)}
              </span>
            </Link>
          </div>
        )}
      </div>

      <div className="pb-6 pt-2">
        <div className="flex gap-2">
          <TxButton
            prepareWrite={prepareApprove}
            transactionName="Approve"
            disabled={!prepareApproveEnabled || !!depositError}
            tooltip={depositError || undefined}
            className="w-full"
          />
          <button
            type="button"
            onClick={executeDeposit}
            disabled={!canDeposit || isPending || isConfirming}
            className={cl(
              'w-full px-4 py-2 rounded-md font-medium transition-colors',
              canDeposit && !isPending && !isConfirming
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {isPending || isConfirming
              ? 'Processing...'
              : isLoadingRoute || depositAmount.isDebouncing
              ? 'Finding route...'
              : isCrossChain ? 'Cross-chain Deposit' : 'Zap In'}
          </button>
        </div>
      </div>
    </div>
  )
}