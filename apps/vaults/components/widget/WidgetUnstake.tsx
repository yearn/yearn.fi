import { formatAmount } from '@lib/utils/format'
import { InputTokenAmount } from '@vaults/components/widget/InputTokenAmount'
import { TxButton } from '@vaults/components/widget/TxButton'
import { useUnstake } from '@vaults/hooks/actions/useUnstake'
import { useInput } from '@vaults/hooks/useInput'
import { useTokens } from '@vaults/hooks/useTokens'
import { type FC, useEffect } from 'react'
import { useAccount } from 'wagmi'

interface Props {
  vaultAddress: `0x${string}`
  gaugeAddress: `0x${string}`
  chainId: number
  handleStakeSuccess?: () => void
}

export const WidgetUnstake: FC<Props> = ({ vaultAddress, gaugeAddress, handleStakeSuccess, chainId }) => {
  const { address: account } = useAccount()
  const { tokens } = useTokens([vaultAddress, gaugeAddress], chainId)

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
    account,
    chainId
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
          <span className="text-text-tertiary">You will burn</span>
          <span className="text-text-secondary font-medium">
            {formatAmount(balance.display)} {gauge?.symbol}
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
