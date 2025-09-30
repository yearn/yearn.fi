import { cl } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { WidgetActionType as ActionType } from '@nextgen/types'
import { type FC, useMemo, useState } from 'react'
import { type Address, erc4626Abi } from 'viem'
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

  const gaugeAddress = '0x622fA41799406B120f9a40dA843D358b7b2CFEE3'

  const SelectedComponent = useMemo(() => {
    switch (mode) {
      case ActionType.Deposit:
        return (
          <WidgetDeposit
            vaultAddress={vaultAddress as `0x${string}`}
            vaultType={vaultType}
            assetAddress={assetToken as Address}
          />
        )
      case ActionType.Withdraw:
        return (
          <WidgetWithdraw
            assetAddress={assetToken as Address}
            vaultAddress={vaultAddress as `0x${string}`}
            vaultType={vaultType}
          />
        )
      case ActionType.Stake:
        return <WidgetStake vaultAddress={vaultAddress as `0x${string}`} gaugeAddress={gaugeAddress as `0x${string}`} />
      case ActionType.Unstake:
        return <WidgetUnstake />
    }
  }, [mode, vaultAddress, vaultType, assetToken])

  return (
    <div className="flex flex-col gap-0 mt-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-100 rounded-lg flex h-12">
          {actions.map((title) => (
            <TabButton key={title} isActive={mode === title} onClick={() => setMode(title)}>
              {title}
            </TabButton>
          ))}
        </div>
        {SelectedComponent}
      </div>
    </div>
  )
}

const TabButton: FC<{
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
        'flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 capitalize',
        isActive
          ? 'bg-white text-gray-900 rounded-bl-none rounded-br-none'
          : 'bg-transparent text-gray-500 hover:text-gray-700',
        className
      )}
    >
      {children}
    </button>
  )
}
