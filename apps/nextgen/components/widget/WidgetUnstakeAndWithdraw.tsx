import { formatAmount, formatTAmount } from '@lib/utils'
import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverCowswap } from '@nextgen/hooks/solvers/useSolverCowswap'
import { useCowswapOrder } from '@nextgen/hooks/useCowswapOrder'
import { useDebouncedInput } from '@nextgen/hooks/useDebouncedInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useCallback, useEffect, useMemo } from 'react'
import type { Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'

interface Props {
  vaultAddress: Address
  gaugeAddress: Address
  assetAddress: Address
  vaultType: 'v2' | 'v3'
  vaultVersion?: string
  chainId?: number
  handleSuccess?: () => void
}

export const WidgetUnstakeAndWithdraw: FC<Props> = ({
  vaultAddress,
  gaugeAddress,
  assetAddress,
  vaultType,
  chainId,
  handleSuccess
}) => {
  const { address: account } = useAccount()
  const { tokens, refetch: refetchTokens } = useTokens([assetAddress, gaugeAddress], chainId)

  const [asset, gauge] = tokens

  // Get price per share from vault
  const { data: pricePerShare = 0n } = useReadContract({
    address: vaultAddress,
    abi: vaultType === 'v2' ? vaultAbi : erc4626Abi,
    functionName: 'pricePerShare',
    chainId,
    query: { enabled: !!vaultAddress && !!asset }
  })

  const withdrawInput = useDebouncedInput(asset?.decimals ?? 18, 500) // 500ms debounce
  const [withdrawAmount] = withdrawInput

  const gaugeTokensNeeded = useMemo(() => {
    if (withdrawAmount.debouncedBn === 0n || pricePerShare === 0n) return 0n

    const assetDecimals = asset?.decimals ?? 18
    const assetUnit = 10n ** BigInt(assetDecimals)

    return (withdrawAmount.debouncedBn * assetUnit) / pricePerShare
  }, [withdrawAmount.debouncedBn, pricePerShare, asset?.decimals])

  const gaugeBalanceInAssets = useMemo(() => {
    if (!gauge?.balance.raw || gauge.balance.raw === 0n || pricePerShare === 0n) return 0n

    const assetDecimals = asset?.decimals ?? 18

    const assetUnit = 10n ** BigInt(assetDecimals)

    return (gauge.balance.raw * pricePerShare) / assetUnit
  }, [gauge?.balance.raw, pricePerShare, asset?.decimals])
  const isWithdrawAmountExceedsBalance = useMemo(
    () => withdrawAmount.debouncedBn > gaugeBalanceInAssets,
    [withdrawAmount.debouncedBn, gaugeBalanceInAssets]
  )

  const {
    actions: { prepareApprove },
    periphery: { prepareApproveEnabled, quote, isLoadingQuote, allowance, isLoadingAllowance, expectedOut },
    getQuote,
    getCowswapOrderParams
  } = useSolverCowswap({
    sellToken: gaugeAddress,
    buyToken: asset?.address as Address,
    amount: gaugeTokensNeeded,
    account,
    chainId,
    decimals: asset?.decimals ?? 18,
    enabled: !!assetAddress && !!gauge
  })

  const hasWithdrawAllowance = useMemo(() => allowance >= gaugeTokensNeeded, [allowance, gaugeTokensNeeded])
  const canWithdraw = useMemo(
    () => hasWithdrawAllowance && !!quote && gaugeTokensNeeded > 0n && !isWithdrawAmountExceedsBalance,
    [hasWithdrawAllowance, quote, gaugeTokensNeeded, isWithdrawAmountExceedsBalance]
  )
  const isWithdrawButtonDisabled = useMemo(() => !canWithdraw, [canWithdraw])

  const handleWithdrawSuccess = useCallback(() => {
    refetchTokens()
    handleSuccess?.()
  }, [refetchTokens, handleSuccess])

  const { prepareCowswapOrder } = useCowswapOrder({
    getCowswapOrderParams,
    enabled: !!quote && gaugeTokensNeeded > 0n
  })

  // Get quote when gauge tokens needed changes
  useEffect(() => {
    if (gaugeTokensNeeded > 0n) {
      getQuote()
    }
  }, [gaugeTokensNeeded, getQuote])

  return (
    <div className="p-6 pb-6 space-y-4">
      <InputTokenAmount
        title="Amount to Withdraw"
        input={withdrawInput}
        placeholder="0.00"
        className="flex-1"
        symbol={asset?.symbol}
        balance={gaugeBalanceInAssets}
        decimals={asset?.decimals}
      />

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary">You will burn</span>
          <span className="text-text-secondary font-medium">
            {gaugeTokensNeeded > 0n ? (
              formatTAmount({ value: gaugeTokensNeeded, decimals: gauge?.decimals ?? 18 }) + ' ' + gauge?.symbol
            ) : (
              <span className="text-text-tertiary">0 {gauge?.symbol}</span>
            )}
          </span>
        </div>
        {(isLoadingQuote || (quote && expectedOut.raw > 0n)) && (
          <div className="flex items-center justify-between">
            <span className="text-text-tertiary">You will receive</span>
            <span className="text-text-secondary font-medium">
              {isLoadingQuote ? (
                <div className="h-4 w-16 bg-surface-secondary rounded animate-pulse" />
              ) : (
                `${formatAmount(expectedOut.normalized)} ${asset?.symbol}`
              )}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2">
        <div className="flex gap-2">
          <TxButton
            prepareWrite={prepareApprove}
            transactionName="Approve"
            disabled={!prepareApproveEnabled || !quote || isWithdrawAmountExceedsBalance}
            className="w-full"
            loading={isLoadingQuote || isLoadingAllowance}
          />
          <TxButton
            prepareWrite={prepareCowswapOrder}
            transactionName={isLoadingQuote || isLoadingAllowance ? 'Getting quote...' : `Withdraw ${asset?.symbol}`}
            disabled={isWithdrawButtonDisabled}
            onSuccess={handleWithdrawSuccess}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
