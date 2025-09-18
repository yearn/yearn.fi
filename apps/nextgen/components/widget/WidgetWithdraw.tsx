import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import type { FC } from 'react'
import { type Address, zeroAddress } from 'viem'
import { type UseSimulateContractReturnType, useAccount, useSimulateContract } from 'wagmi'
import { useInput } from '../../hooks/useInput'
import { InputTokenAmount } from '../InputTokenAmount'
import { TxButton } from '../TxButton'

interface Props {
  account: Address
  handleWithdrawSuccess?: () => void
  vaultAddress?: `0x${string}`
}

export const WidgetWithdraw: FC<Props> = ({ vaultAddress, handleWithdrawSuccess }) => {
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

  const input = useInput(vaultDetails?.asset?.decimals)
  const [amount] = input

  // ** ACTIONS ** //
  const prepareWithdraw: UseSimulateContractReturnType = useSimulateContract({
    abi: erc4626Abi,
    functionName: 'withdraw',
    address: vaultDetails?.address,
    args: amount.bn > 0n ? [amount.bn, address!, address!] : undefined,
    query: {
      enabled: Boolean(amount.bn > 0n && vaultDetails?.address !== zeroAddress)
    }
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
        disabled={!prepareWithdraw.data || amount.bn === 0n}
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
