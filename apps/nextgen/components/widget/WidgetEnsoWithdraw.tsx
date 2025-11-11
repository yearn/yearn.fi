import Link from '@components/Link'
import { formatAmount } from '@lib/utils'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useEnsoOrder } from '@nextgen/hooks/useEnsoOrder'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'
import { ReceiveTokenSelector } from '../ReceiveTokenSelector'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  chainId: number
  handleWithdrawSuccess?: () => void
}

export const WidgetEnsoWithdraw: FC<Props> = ({
  vaultAddress,
  assetAddress,
  chainId,
  handleWithdrawSuccess: onWithdrawSuccess
}) => {
  const { address: account } = useAccount()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)

  // Determine which token to withdraw to
  const withdrawToken = selectedToken || assetAddress
  const { tokens, refetch: refetchTokens } = useTokens([vaultAddress, withdrawToken], chainId)
  const [vault, outputToken] = tokens
  const withdrawInput = useDebouncedInput(vault?.decimals ?? 18)
  const [withdrawAmount, , setWithdrawInput] = withdrawInput

  // Withdraw flow using Enso
  const {
    actions: { prepareApprove },
    periphery: { prepareApproveEnabled, route, isLoadingRoute, expectedOut, routerAddress, allowance },
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

  // Fetch route when debounced amount changes
  useEffect(() => {
    if (withdrawAmount.debouncedBn > 0n && !withdrawAmount.isDebouncing) {
      getRoute()
    }
  }, [withdrawAmount.debouncedBn, withdrawAmount.isDebouncing, getRoute])

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

  const isAllowanceSufficient = !routerAddress || allowance >= withdrawAmount.bn
  const canWithdraw = route && !withdrawError && withdrawAmount.bn > 0n && isAllowanceSufficient

  // Use the new useEnsoOrder hook for cleaner integration with TxButton
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
      onWithdrawSuccess?.()
    }
  }, [receiptSuccess, txHash, setWithdrawInput, refetchTokens, onWithdrawSuccess])

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
        disabled={isWaitingForTx}
      />

      <div className="space-y-1 text-sm h-8">
        <ReceiveTokenSelector
          amount={withdrawAmount.bn > 0n && route ? formatAmount(expectedOut.normalized) : '0.00'}
          token={outputToken}
          tokenAddress={selectedToken}
          onTokenChange={setSelectedToken}
          chainId={chainId}
          excludeTokens={[vaultAddress]}
          isLoading={isLoadingRoute || withdrawAmount.isDebouncing}
          showSelector={true}
          disabled={isWaitingForTx}
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
          <TxButton
            prepareWrite={prepareEnsoOrder}
            transactionName={
              isLoadingRoute || withdrawAmount.isDebouncing
                ? 'Finding route...'
                : !isAllowanceSufficient
                  ? 'Approve First'
                  : 'Zap Out'
            }
            disabled={!canWithdraw || isLoadingRoute || withdrawAmount.isDebouncing}
            loading={isLoadingRoute || withdrawAmount.isDebouncing}
            tooltip={withdrawError || (!isAllowanceSufficient ? 'Please approve token first' : undefined)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
