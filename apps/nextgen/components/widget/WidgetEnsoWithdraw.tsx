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
import { ReceiveTokenSelector } from '../ReceiveTokenSelector'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  tokenOut?: Address // Optional custom token to zap to
  chainId: number
  handleWithdrawSuccess?: () => void
}

export const WidgetEnsoWithdraw: FC<Props> = ({
  vaultAddress,
  assetAddress,
  tokenOut,
  chainId,
  handleWithdrawSuccess
}) => {
  const { address: account } = useAccount()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(tokenOut || assetAddress)

  // Determine which token to withdraw to
  const withdrawToken = tokenOut || selectedToken || assetAddress
  const { tokens, refetch: refetchTokens } = useTokens([vaultAddress, withdrawToken], chainId)
  const [vault, outputToken] = tokens

  const withdrawInput = useDebouncedInput(vault?.decimals ?? 18)
  const [withdrawAmount] = withdrawInput

  // Withdraw flow using Enso
  const {
    actions: { prepareApprove },
    periphery: { prepareApproveEnabled, route, isLoadingRoute, expectedOut, routerAddress },
    getRoute,
    getEnsoTransaction
  } = useSolverEnso({
    tokenIn: vaultAddress,
    tokenOut: withdrawToken,
    amountIn: withdrawAmount.debouncedBn,
    fromAddress: account,
    chainId,
    decimalsOut: outputToken?.decimals ?? 18,
    enabled: !!withdrawToken && !withdrawAmount.isDebouncing
  })

  // Transaction handling
  const ensoTx = getEnsoTransaction()
  const { sendTransaction, data: txHash, isPending } = useSendTransaction()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
    query: {
      enabled: !!txHash
    }
  })

  const executeWithdraw = useCallback(() => {
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
    if (withdrawAmount.debouncedBn > 0n && !withdrawAmount.isDebouncing) {
      getRoute()
    }
  }, [withdrawAmount.debouncedBn, withdrawAmount.isDebouncing, getRoute])

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      refetchTokens()
      handleWithdrawSuccess?.()
    }
  }, [isSuccess, refetchTokens, handleWithdrawSuccess])

  // Error handling
  const withdrawError = useMemo(() => {
    if (withdrawAmount.bn === 0n) return null
    if (withdrawAmount.bn > (vault?.balance.raw || 0n)) {
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
    vault?.balance.raw,
    route,
    isLoadingRoute
  ])

  const canWithdraw = route && !withdrawError && withdrawAmount.bn > 0n

  return (
    <div className="p-6 pb-0 space-y-4">
      <InputTokenAmount
        title="Amount to Withdraw"
        input={withdrawInput}
        placeholder="0.00"
        className="flex-1"
        symbol={vault?.symbol}
        balance={vault?.balance.raw || 0n}
        decimals={vault?.decimals}
      />

      <div className="space-y-1 text-sm h-8">
        <ReceiveTokenSelector
          amount={formatAmount(expectedOut.normalized)}
          token={outputToken}
          tokenAddress={selectedToken}
          onTokenChange={setSelectedToken}
          chainId={chainId}
          excludeTokens={[vaultAddress]}
          isLoading={isLoadingRoute || withdrawAmount.isDebouncing}
          showSelector={!tokenOut}
        />
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
        <div className="flex gap-2 w-full">
          <TxButton
            prepareWrite={prepareApprove}
            transactionName="Approve"
            disabled={!prepareApproveEnabled || !!withdrawError}
            tooltip={withdrawError || undefined}
            className="w-full"
          />
          <button
            type="button"
            onClick={executeWithdraw}
            disabled={!canWithdraw || isPending || isConfirming}
            className={cl(
              'w-full px-4 py-2 rounded-md font-medium transition-colors',
              canWithdraw && !isPending && !isConfirming
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {isPending || isConfirming
              ? 'Processing...'
              : isLoadingRoute || withdrawAmount.isDebouncing
                ? 'Finding route...'
                : 'Zap Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
