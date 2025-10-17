import Link from '@components/Link'
import { formatAmount } from '@lib/utils'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useEnsoOrder } from '@nextgen/hooks/useEnsoOrder'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'
import { TokenSelector } from '../TokenSelector'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  chainId: number
  destinationChainId?: number // For cross-chain operations
  handleDepositSuccess?: () => void
}

export const WidgetEnsoDeposit: FC<Props> = ({
  vaultAddress,
  assetAddress,
  chainId,
  destinationChainId,
  handleDepositSuccess: onDepositSuccess
}) => {
  const { address: account } = useAccount()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)

  // Determine which token to use for deposits
  const depositToken = selectedToken || assetAddress
  const { tokens, refetch: refetchTokens } = useTokens([depositToken, vaultAddress], chainId)
  const [inputToken, vault] = tokens

  const depositInput = useDebouncedInput(inputToken?.decimals ?? 18)
  const [depositAmount, , setDepositInput] = depositInput

  // Deposit flow using Enso
  const {
    actions: { prepareApprove },
    periphery: { prepareApproveEnabled, route, isLoadingRoute, expectedOut, routerAddress, isCrossChain, allowance },
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
      onDepositSuccess?.()
    }
  }, [receiptSuccess, txHash, setDepositInput, refetchTokens, onDepositSuccess])

  return (
    <div className="p-6 pb-0 space-y-4">
      <InputTokenAmount
        title="Amount to Deposit"
        input={depositInput}
        placeholder="0.00"
        className="flex-1"
        symbol={inputToken?.symbol}
        balance={inputToken?.balance.raw || 0n}
        decimals={inputToken?.decimals}
        showTokenSelector={true}
        disabled={isWaitingForTx}
        tokenSelectorElement={
          <TokenSelector
            value={selectedToken}
            onChange={(address) => {
              setSelectedToken(address)
            }}
            chainId={chainId}
            excludeTokens={[vaultAddress]}
            onClose={() => {
              // This will trigger the close through InputTokenAmount
              const button = document.querySelector('[data-token-selector-button]') as HTMLButtonElement
              button?.click()
            }}
          />
        }
      />

      <div className="space-y-1 text-sm h-8">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">You will receive</span>
          <span className="text-gray-500 font-medium">
            {isLoadingRoute || depositAmount.isDebouncing ? (
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            ) : depositAmount.bn > 0n && route ? (
              `${formatAmount(expectedOut.normalized)} ${vault?.symbol}`
            ) : (
              `0.00 ${vault?.symbol || ''}`
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
                    : 'Zap In'
            }
            disabled={!canDeposit || isLoadingRoute || depositAmount.isDebouncing}
            loading={isLoadingRoute || depositAmount.isDebouncing}
            tooltip={depositError || (!isAllowanceSufficient ? 'Please approve token first' : undefined)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
