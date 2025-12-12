import { exactToSimple, formatAmount } from '@lib/utils'
import { TxButton } from '@nextgen/components/TxButton'
import { useWithdraw } from '@nextgen/hooks/actions/useWithdraw'
import { useInput } from '@nextgen/hooks/useInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import type { FC } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'

interface Props {
  vaultType: 'v2' | 'v3'
  assetAddress: `0x${string}`
  vaultAddress: `0x${string}`
  handleWithdrawSuccess?: () => void
  chainId?: number
}

export const WidgetWithdraw: FC<Props> = ({
  vaultType,
  vaultAddress,
  assetAddress,
  handleWithdrawSuccess,
  chainId
}) => {
  const { address: account } = useAccount()
  const { tokens } = useTokens([assetAddress, vaultAddress], chainId)

  // ** PERIPHERY ** //
  const [asset, vault] = [tokens?.[0], tokens?.[1]]
  const input = useInput(vault?.decimals ?? 18)
  const [amount] = input

  // ** ACTIONS ** //
  const {
    actions: { prepareWithdraw },
    periphery: { prepareWithdrawEnabled, expectedWithdrawAmount, maxRedeem }
  } = useWithdraw({
    vaultType: vaultType,
    vaultAddress: vaultAddress as Address,
    amount: amount.bn,
    account,
    chainId
  })

  return (
    <div className="p-6 pb-0 space-y-4">
      <InputTokenAmount
        title="Amount to Withdraw"
        input={input}
        placeholder="0.00"
        className="flex-1"
        symbol={asset?.symbol}
        balance={maxRedeem}
      />
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary">You will burn</span>
          <span className="text-text-secondary font-medium">
            {formatAmount(exactToSimple(expectedWithdrawAmount, vault?.decimals ?? 18))} {vault?.symbol}
          </span>
        </div>
      </div>
      {/* <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setUnstakeAndWithdraw(!unstakeAndWithdraw)}
          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          style={{ backgroundColor: unstakeAndWithdraw ? '#1D4ED8' : '#E4E4E7' }}
        >
          <span
            className={cl(
              'inline-block h-4 w-4 transform rounded-full bg-surface shadow-lg transition duration-200 ease-in-out',
              unstakeAndWithdraw ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
        <span className="ml-3 text-sm font-medium text-text-primary">Unstake & Withdraw</span>
      </div> */}
      <div className="pb-6 pt-2">
        <TxButton
          prepareWrite={prepareWithdraw}
          onSuccess={handleWithdrawSuccess}
          transactionName={'Withdraw'}
          disabled={!prepareWithdrawEnabled}
          className="w-full"
        />
      </div>
    </div>
  )
}
