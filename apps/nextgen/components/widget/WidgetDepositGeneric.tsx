import { cl, formatAmount, formatTAmount } from '@lib/utils'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverEnso } from '@nextgen/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useEnsoOrder } from '@nextgen/hooks/useEnsoOrder'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { TokenSelector } from '../TokenSelector'

interface Props {
  vaultAddress: Address
  assetAddress: Address
  chainId: number
  destinationChainId?: number // For cross-chain operations
  handleDepositSuccess?: () => void
}

export const WidgetDepositGeneric: FC<Props> = ({
  vaultAddress,
  assetAddress,
  chainId,
  destinationChainId,
  handleDepositSuccess: onDepositSuccess
}) => {
  const { address: account } = useAccount()
  const [selectedToken, setSelectedToken] = useState<Address | undefined>(assetAddress)
  const [showTokenSelector, setShowTokenSelector] = useState(false)

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

  // Mock annual return calculation - replace with actual logic
  const estimatedAnnualReturn = depositAmount.bn > 0n ? formatAmount(expectedOut.normalized * 0.1) : '0'

  return (
    <div className="flex flex-col relative">
      {/* Amount Section */}
      <div className="px-6 pt-6 pb-6">
        {/* Amount Input */}
        <div className="flex flex-col gap-4">
          <div className="relative">
            <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-end">
                <label className="font-medium text-sm text-gray-900">Amount</label>
                <p className="text-[10px] text-zinc-500 font-medium">
                  Balance: {formatAmount(inputToken?.balance.normalized || 0)} {inputToken?.symbol}
                </p>
              </div>
              <div className="relative flex items-center gap-2">
                <div className="bg-white border border-gray-200 rounded-md h-9 flex-1">
                  <div className="flex gap-1 h-9 items-center px-3 py-1">
                    <input
                      type="text"
                      value={depositAmount.formValue}
                      onChange={(e) => depositInput[1](e)}
                      placeholder="0"
                      disabled={isWaitingForTx}
                      className="flex-1 font-normal text-sm text-gray-900 outline-none bg-transparent"
                    />
                    <span className="text-sm text-zinc-500 font-normal">{inputToken?.symbol}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (inputToken?.balance.raw) {
                      const fullBalance = inputToken.balance.normalized.toString()
                      depositInput[2](fullBalance)
                    }
                  }}
                  className="bg-white border border-gray-200 flex gap-2 h-9 items-center justify-center px-8 py-2 rounded-md"
                >
                  <span className="font-medium text-sm text-gray-900">Max</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Selection and Details */}
      <div className="px-6">
        {/* Deposit Token Selector */}
        <div className="flex flex-col gap-2 mb-6">
          <label className="font-medium text-sm text-gray-900">Deposit Token</label>
          <button
            onClick={() => setShowTokenSelector(!showTokenSelector)}
            className="bg-white border border-gray-200 rounded-md h-9 w-full flex items-center justify-between px-3 py-2"
          >
            <span className="font-normal text-sm text-gray-900">{inputToken?.symbol || 'Select Token'}</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">You will deposit</p>
            <p className="text-sm text-gray-900">
              {depositAmount.bn > 0n
                ? formatTAmount({
                    value: depositAmount.debouncedBn,
                    decimals: inputToken?.decimals ?? 18
                  })
                : '0'}{' '}
              {inputToken?.symbol}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">You will receive</p>
            <p className="text-sm text-gray-900">
              {isLoadingRoute || depositAmount.isDebouncing ? (
                <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
              ) : depositAmount.bn > 0n && route ? (
                `${formatAmount(expectedOut.normalized)} ${vault?.symbol} (?)`
              ) : (
                `0 ${vault?.symbol || ''} (?)`
              )}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Est. Annual Return</p>
            <p className="text-sm text-gray-900">
              {depositAmount.bn > 0n && route ? `~${estimatedAnnualReturn} ${inputToken?.symbol} (?)` : '~0 (?)'}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 pb-6 pt-6">
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
                    : 'Deposit'
            }
            disabled={!canDeposit || isLoadingRoute || depositAmount.isDebouncing}
            loading={isLoadingRoute || depositAmount.isDebouncing}
            tooltip={depositError || (!isAllowanceSufficient ? 'Please approve token first' : undefined)}
            className="w-full"
          />
        </div>
      </div>

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
            onChange={(address) => {
              setSelectedToken(address)
              setShowTokenSelector(false)
            }}
            chainId={chainId}
            excludeTokens={[vaultAddress]}
            onClose={() => setShowTokenSelector(false)}
          />
        </div>
      </div>
    </div>
  )
}
