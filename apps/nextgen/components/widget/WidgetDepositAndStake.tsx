import Link from '@components/Link'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverGaugeStakingBooster } from '@nextgen/hooks/solvers/useSolverGaugeStakingBooster'
import { useInput } from '@nextgen/hooks/useInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useCallback, useMemo } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
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

export const WidgetDepositAndStake: FC<Props> = ({
  vaultAddress,
  gaugeAddress,
  assetAddress,
  vaultVersion,
  chainId,
  handleSuccess
}) => {
  const { address: account } = useAccount()
  const { tokens, refetch: refetchTokens } = useTokens([assetAddress, gaugeAddress], chainId)

  const [asset, gauge] = tokens

  const depositInput = useInput(asset?.decimals ?? 18)
  const [depositAmount] = depositInput

  const {
    actions: { prepareApprove, prepareZapIn },
    periphery: { prepareApproveEnabled, prepareZapInEnabled }
  } = useSolverGaugeStakingBooster({
    vaultAddress,
    gaugeAddress,
    tokenAddress: asset?.address as Address,
    amount: depositAmount.bn,
    account,
    chainId,
    vaultVersion,
    enabled: !!assetAddress && !!account
  })

  const isDepositAmountExceedsBalance = useMemo(
    () => depositAmount.bn > (asset?.balance.raw || 0n),
    [depositAmount.bn, asset?.balance.raw]
  )

  const depositError = useMemo(() => {
    if (depositAmount.bn === 0n) return null

    if (isDepositAmountExceedsBalance) {
      return 'Insufficient balance to deposit this amount'
    }

    return null
  }, [depositAmount.bn, isDepositAmountExceedsBalance])

  const handleDepositSuccess = useCallback(() => {
    refetchTokens()
    handleSuccess?.()
  }, [refetchTokens, handleSuccess])

  return (
    <div className="p-6 pb-0 space-y-4">
      <InputTokenAmount
        title="Amount to Deposit"
        input={depositInput}
        placeholder="0.00"
        className="flex-1"
        symbol={asset?.symbol}
        balance={asset?.balance.raw || 0n}
        decimals={asset?.decimals}
      />

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">You will deposit into</span>
          <Link className="" href={`https://etherscan.io/address/${gaugeAddress}#code`}>
            <span className="text-gray-500 font-medium hover:underline">{gauge?.symbol}</span>
          </Link>
        </div>
      </div>

      <div className="pb-6 pt-2">
        <div className="flex gap-2">
          <TxButton
            prepareWrite={prepareApprove}
            transactionName="Approve"
            disabled={!prepareApproveEnabled || isDepositAmountExceedsBalance}
            tooltip={depositError || undefined}
            className="w-full"
          />
          <TxButton
            prepareWrite={prepareZapIn}
            transactionName="Deposit"
            disabled={!prepareZapInEnabled || isDepositAmountExceedsBalance}
            tooltip={depositError || undefined}
            onSuccess={handleDepositSuccess}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
