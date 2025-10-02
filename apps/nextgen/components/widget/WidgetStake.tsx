import { formatAmount } from '@lib/utils/format'
import { InputTokenAmount } from '@nextgen/components/InputTokenAmount'
import { TxButton } from '@nextgen/components/TxButton'
import { useStake } from '@nextgen/hooks/actions/useStake'
import { useInput } from '@nextgen/hooks/useInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useEffect } from 'react'
import { useAccount } from 'wagmi'

interface Props {
  vaultAddress: `0x${string}`
  gaugeAddress: `0x${string}`
  handleStakeSuccess?: () => void
}

export const WidgetStake: FC<Props> = ({ vaultAddress, gaugeAddress, handleStakeSuccess }) => {
  const { address: account } = useAccount()
  const { tokens } = useTokens([vaultAddress, gaugeAddress])

  // ** PERIPHERY ** //
  const [vault, gauge] = [tokens?.[0], tokens?.[1]]
  const input = useInput(vault?.decimals ?? 18)
  const [amount, _, setAmount] = input

  // ** ACTIONS ** //
  const {
    actions: { prepareApprove, prepareStake },
    periphery: { prepareApproveEnabled, prepareStakeEnabled, balance, expectedStakeAmount }
  } = useStake({
    gaugeAddress,
    vaultAddress,
    amount: amount.bn,
    account
  })

  useEffect(() => {
    if (!amount.simple) {
      setAmount(balance.display.toString())
    }
  }, [balance, setAmount, amount.simple])

  return (
    <div className="p-6 pb-0 space-y-4">
      <InputTokenAmount
        title="Amount to Stake"
        input={input}
        placeholder="0.00"
        disabled
        className="flex-1"
        symbol={vault?.symbol}
        balance={balance.raw}
      />

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">You will receive</span>
          <span className="text-gray-500 font-medium">
            {formatAmount(expectedStakeAmount.display)} {gauge?.symbol}
          </span>
        </div>
      </div>

      <div className="pb-6 pt-2">
        <div className="flex gap-2">
          <TxButton
            prepareWrite={prepareApprove}
            transactionName="Approve"
            disabled={!prepareApproveEnabled}
            className="w-full"
          />
          <TxButton
            prepareWrite={prepareStake}
            transactionName={`Stake`}
            disabled={!prepareStakeEnabled}
            onSuccess={handleStakeSuccess}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
