import { useWithdraw } from '@nextgen/hooks/actions/useWithdraw'
import { useTokens } from '@nextgen/hooks/useTokens'
import type { FC } from 'react'
import type { Address } from 'viem'
import { useInput } from '../../hooks/useInput'
import { InputTokenAmount } from '../InputTokenAmount'
import { TxButton } from '../TxButton'

interface Props {
  account: Address
  vaultType: 'v2' | 'v3'
  vaultAddress: `0x${string}`
  handleWithdrawSuccess?: () => void
}

export const WidgetWithdraw: FC<Props> = ({ vaultType, vaultAddress, account, handleWithdrawSuccess }) => {
  const { tokens } = useTokens([vaultAddress], account)

  // ** PERIPHERY ** //

  const vault = tokens?.[0]
  const input = useInput(vault?.decimals ?? 18)
  const [amount] = input

  // ** ACTIONS ** //

  const {
    actions: { prepareWithdraw },
    periphery: { prepareWithdrawEnabled }
  } = useWithdraw({
    vaultType: vaultType,
    vaultAddress: vaultAddress as Address,
    amount: amount.bn,
    account
  })

  return (
    <div className="space-y-3">
      {/* Amount Section */}
      <InputTokenAmount
        title="Amount to Withdraw"
        input={input}
        placeholder="0.00"
        className="flex-1"
        symbol={vault?.symbol}
        balance={vault?.balance}
      />
      {/* Action Button */}
      {input[0].touched ? (
        <TxButton
          prepareWrite={prepareWithdraw}
          onSuccess={handleWithdrawSuccess}
          transactionName="Withdraw"
          disabled={!prepareWithdrawEnabled}
          className="w-full"
        />
      ) : (
        <TxButton
          prepareWrite={prepareWithdraw}
          transactionName="Enter an amount"
          disabled={!prepareWithdrawEnabled}
          className="w-full"
        />
      )}
    </div>
  )
}
