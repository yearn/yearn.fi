import { useDeposit } from '@nextgen/hooks/actions/useDeposit'
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
  assetAddress: `0x${string}`
  handleDepositSuccess?: () => void
}

export const WidgetDeposit: FC<Props> = ({ account, vaultType, vaultAddress, assetAddress, handleDepositSuccess }) => {
  const { tokens } = useTokens([assetAddress, vaultAddress], account)

  // ** PERIPHERY ** //

  const [asset, vault] = [tokens?.[0], tokens?.[1]]
  const input = useInput(asset?.decimals ?? 18)
  const [amount] = input

  // ** ACTIONS ** //

  const {
    actions: { prepareApprove, prepareDeposit },
    periphery: { prepareApproveEnabled, prepareDepositEnabled }
  } = useDeposit({
    vaultType,
    assetAddress: asset?.address as Address,
    vaultAddress: vault?.address as Address,
    amount: amount.bn,
    account
  })

  return (
    <div className="space-y-3">
      {/* Amount Section */}
      <InputTokenAmount
        title="Amount to Deposit"
        input={input}
        placeholder="0.00"
        className="flex-1"
        symbol={asset?.symbol}
        balance={asset?.balance}
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
            transactionName={`Deposit ${asset?.symbol || ''}`}
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
