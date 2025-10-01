import { formatAmount } from '@lib/utils/format'
import { InputTokenAmount } from '@nextgen/components/InputTokenAmount'
import { TxButton } from '@nextgen/components/TxButton'
import { useUnstake } from '@nextgen/hooks/actions/useUnstake'
import { useInput } from '@nextgen/hooks/useInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useEffect } from 'react'
import { useAccount } from 'wagmi'

interface Props {
  vaultAddress: `0x${string}`
  gaugeAddress: `0x${string}`
  handleStakeSuccess?: () => void
}

export const WidgetUnstake: FC<Props> = ({ vaultAddress, gaugeAddress, handleStakeSuccess }) => {
  const { address: account } = useAccount()
  const { tokens } = useTokens([vaultAddress, gaugeAddress])

  // ** PERIPHERY ** //
  const [vault, gauge] = [tokens?.[0], tokens?.[1]]
  const input = useInput(vault?.decimals ?? 18)
  const [amount, _, setAmount] = input

  // ** ACTIONS ** //
  const {
    actions: { prepareUnstake },
    periphery: { prepareUnstakeEnabled, balance }
  } = useUnstake({
    gaugeAddress,
    amount: amount.bn,
    decimals: vault?.decimals ?? 18,
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
        title="Amount to Unstake"
        input={input}
        placeholder="0.00"
        className="flex-1"
        symbol={vault?.symbol}
        balance={balance.raw}
      />

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">You will receive</span>
          <span className="text-gray-900 font-medium">
            {formatAmount(balance.display)} {vault?.symbol}
          </span>
        </div>
      </div>

      <div className="pb-6 pt-2">
        <div className="flex gap-2">
          <TxButton
            prepareWrite={prepareUnstake}
            transactionName={`Unstake`}
            disabled={!prepareUnstakeEnabled}
            onSuccess={handleStakeSuccess}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
