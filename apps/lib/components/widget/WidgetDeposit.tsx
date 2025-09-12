import { useBalanceQuery } from '@lib/hooks/useBalancesQuery'
import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import type { FC } from 'react'
import type { Address } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'
import { useInput } from '../../hooks/useInput'
import { useTokenAllowance } from '../../hooks/useTokenAllowance'
import { InputTokenAmount } from '../InputTokenAmount'
import { TxButton } from '../TxButton'

interface Props {
  account: Address
  vaultAddress?: `0x${string}`
  handleDepositSuccess?: () => void
}

export const WidgetDeposit: FC<Props> = ({ account, vaultAddress, handleDepositSuccess }) => {
  const vaultDetails = {
    address: vaultAddress,
    asset: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      decimals: 18
    }
  }

  // ** PERIPHERY ** //
  const input = useInput(vaultDetails?.asset?.decimals ?? 18)
  const [amount] = input

  const { data: assetBalance } = useBalanceQuery(1, account, {
    address: vaultDetails?.asset?.address as Address,
    chainID: 1
  })

  const { allowance: depositAllowance = 0n } = useTokenAllowance({
    account,
    token: vaultDetails?.asset?.address as Address,
    spender: vaultDetails?.address as Address,
    watch: true
  })

  const isValidInput = amount.bn > 0n
  const isDepositAllowanceSufficient = Boolean(depositAllowance >= amount.bn)
  const prepareApproveEnabled = Boolean(!isDepositAllowanceSufficient && isValidInput)
  const prepareDepositEnabled = Boolean(isDepositAllowanceSufficient && isValidInput)

  // ** ACTIONS ** //
  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc4626Abi,
    functionName: 'approve',
    address: vaultDetails?.asset?.address as Address,
    args: amount.bn > 0n && vaultDetails?.address ? [vaultDetails?.address, amount.bn] : undefined,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareDeposit: UseSimulateContractReturnType = useSimulateContract({
    abi: erc4626Abi,
    functionName: 'deposit',
    address: vaultDetails?.address,
    args: account && amount.bn > 0n ? [amount.bn, account] : undefined,
    account,
    query: { enabled: prepareDepositEnabled }
  })

  return (
    <div className="space-y-3">
      {/* Amount Section */}
      <InputTokenAmount
        title="Amount to Deposit"
        input={input}
        placeholder="0.00"
        className="flex-1"
        symbol={vaultDetails?.asset?.symbol}
        balance={assetBalance?.balance.raw}
      />

      {/* Action Button */}
      {input[0].touched ? (
        <div className="flex gap-1">
          <TxButton
            prepareWrite={prepareApprove}
            transactionName="Approve"
            disabled={!prepareApproveEnabled}
            className="w-full"
          />
          <TxButton
            prepareWrite={prepareDeposit}
            transactionName={`Deposit ${vaultDetails?.asset?.symbol || ''}`}
            disabled={!prepareDepositEnabled}
            onSuccess={handleDepositSuccess}
            className="w-full"
          />
        </div>
      ) : (
        <TxButton
          prepareWrite={prepareApprove}
          transactionName="Enter an amount"
          disabled={!prepareApproveEnabled}
          className="w-full"
        />
      )}
    </div>
  )
}
