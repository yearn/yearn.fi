import { cl } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { WidgetActionType as ActionType } from '@nextgen/types'
import { type FC, useMemo, useState } from 'react'
import { type Address, erc4626Abi, zeroAddress } from 'viem'
import { useReadContract } from 'wagmi'
import { WidgetDeposit } from './WidgetDeposit'
import { WidgetStake } from './WidgetStake'
import { WidgetUnstake } from './WidgetUnstake'
import { WidgetWithdraw } from './WidgetWithdraw'

interface Props {
  vaultAddress?: `0x${string}`
  vaultType: 'v2' | 'v3'
  actions: ActionType[]
}

export const Widget: FC<Props> = ({ vaultAddress, vaultType, actions }) => {
  const [mode, setMode] = useState<ActionType>(actions[0])

  const { data: assetToken } = useReadContract({
    address: vaultAddress as Address,
    abi: vaultType === 'v2' ? vaultAbi : erc4626Abi,
    functionName: vaultType === 'v2' ? 'token' : 'asset'
  })

  const SelectedComponent = useMemo(() => {
    switch (mode) {
      case ActionType.Deposit:
        return (
          <WidgetDeposit
            account={zeroAddress}
            vaultAddress={vaultAddress as `0x${string}`}
            vaultType={vaultType}
            assetAddress={assetToken as Address}
          />
        )
      case ActionType.Withdraw:
        return (
          <WidgetWithdraw account={zeroAddress} vaultAddress={vaultAddress as `0x${string}`} vaultType={vaultType} />
        )
      case ActionType.Stake:
        return <WidgetStake />
      case ActionType.Unstake:
        return <WidgetUnstake />
    }
  }, [mode, vaultAddress, vaultType, assetToken])

  return (
    <div className="flex flex-col gap-4 mt-16">
      <div className="bg-black/5 rounded-2xl p-1">
        <div className="bg-black/15 p-0.5 rounded-xl flex gap-1 mb-2">
          {actions.map((title) => (
            <Button key={title} onClick={() => setMode(title)} isActive={mode === title} className="capitalize">
              {title}
            </Button>
          ))}
        </div>
        <div className="bg-white rounded-xl p-2">{SelectedComponent}</div>
      </div>
    </div>
  )
}

const Button: FC<{
  className?: string
  children: React.ReactNode
  onClick: () => void
  isActive: boolean
}> = ({ children, onClick, isActive, className }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cl(
        'flex-1 px-4 py-2 rounded-[10px] font-semibold text-base transition-all duration-200 cursor-pointer',
        isActive ? 'bg-white text-black shadow-sm' : 'bg-transparent text-white/80 hover:text-white',
        className
      )}
    >
      {children}
    </button>
  )
}
