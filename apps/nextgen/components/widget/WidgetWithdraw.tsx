import { useWithdraw } from '@nextgen/hooks/actions/useWithdraw'
import type { FC } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { useInput } from '../../hooks/useInput'
import { InputTokenAmount } from '../InputTokenAmount'
import { TxButton } from '../TxButton'

interface Props {
  account: Address
  handleWithdrawSuccess?: () => void
  vaultType: 'v2' | 'v3'
  vaultAddress?: `0x${string}`
}

export const WidgetWithdraw: FC<Props> = ({ vaultType, vaultAddress, handleWithdrawSuccess }) => {
  const { address } = useAccount()

  const vaultDetails = {
    address: vaultAddress,
    asset: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      decimals: 18
    },
    user: {
      assets: 0n
    }
  }

  // ** PERIPHERY ** //

  const input = useInput(vaultDetails?.asset?.decimals)
  const [amount] = input

  // ** ACTIONS ** //

  const {
    actions: { prepareWithdraw },
    periphery: { prepareWithdrawEnabled }
  } = useWithdraw({
    vaultType: vaultType,
    vaultAddress: vaultDetails?.address as Address,
    amount: amount.bn,
    account: address!
  })

  return (
    <div className="space-y-3">
      {/* Amount Section */}
      <InputTokenAmount
        title="Amount to Withdraw"
        input={input}
        placeholder="0.00"
        className="flex-1"
        symbol={vaultDetails?.asset?.symbol}
        balance={vaultDetails?.user?.assets}
      />
      <TxButton
        prepareWrite={prepareWithdraw}
        onSuccess={handleWithdrawSuccess}
        transactionName="Withdraw"
        disabled={!prepareWithdrawEnabled}
        className="w-full"
        style={{
          backgroundColor: '#401BE4',
          color: 'white',
          padding: '12px',
          borderRadius: '12px',
          fontWeight: 500,
          fontSize: '16px'
        }}
      />
    </div>
  )
}
