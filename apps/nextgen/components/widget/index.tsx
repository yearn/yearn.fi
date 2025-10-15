import type { TAddress } from '@lib/types'
import { cl, toAddress } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { WidgetActionType as ActionType } from '@nextgen/types'
import { type FC, useMemo, useState } from 'react'
import { type Address, erc4626Abi } from 'viem'
import { useReadContract } from 'wagmi'
import { WidgetDeposit } from './WidgetDeposit'
import { WidgetDepositAndStake } from './WidgetDepositAndStake'
import { WidgetEnsoDeposit } from './WidgetEnsoDeposit'
import { WidgetEnsoWithdraw } from './WidgetEnsoWithdraw'
import { WidgetStake } from './WidgetStake'
import { WidgetUnstake } from './WidgetUnstake'
import { WidgetUnstakeAndWithdraw } from './WidgetUnstakeAndWithdraw'
import { WidgetWithdraw } from './WidgetWithdraw'

interface Props {
  vaultAddress?: TAddress
  gaugeAddress?: TAddress
  vaultType: 'v2' | 'v3'
  vaultVersion?: string
  actions: ActionType[]
  chainId: number
  handleSuccess?: () => void
}

const getActionLabel = (action: ActionType): string => {
  switch (action) {
    case ActionType.Deposit:
      return 'Deposit'
    case ActionType.Withdraw:
      return 'Withdraw'
    case ActionType.Stake:
      return 'Stake'
    case ActionType.Unstake:
      return 'Unstake'
    case ActionType.DepositAndStake:
      return 'Deposit'
    case ActionType.UnstakeAndWithdraw:
      return 'Withdraw'
    case ActionType.EnsoDeposit:
      return 'Zap In'
    case ActionType.EnsoWithdraw:
      return 'Zap Out'
    default:
      return action
  }
}

export const Widget: FC<Props> = ({
  vaultAddress,
  gaugeAddress,
  vaultType,
  vaultVersion,
  actions,
  chainId,
  handleSuccess
}) => {
  const [mode, setMode] = useState<ActionType>(actions[0])

  const { data: assetToken } = useReadContract({
    address: vaultAddress as Address,
    abi: vaultType === 'v2' ? vaultAbi : erc4626Abi,
    functionName: vaultType === 'v2' ? 'token' : 'asset',
    chainId
  })
  const SelectedComponent = useMemo(() => {
    switch (mode) {
      case ActionType.Deposit:
        return (
          <WidgetDeposit
            vaultAddress={toAddress(vaultAddress)}
            vaultType={vaultType}
            assetAddress={toAddress(assetToken)}
            chainId={chainId}
          />
        )
      case ActionType.Withdraw:
        return (
          <WidgetWithdraw
            assetAddress={toAddress(assetToken)}
            vaultAddress={toAddress(vaultAddress)}
            vaultType={vaultType}
            chainId={chainId}
          />
        )
      case ActionType.Stake:
        return (
          <WidgetStake
            vaultAddress={toAddress(vaultAddress)}
            gaugeAddress={toAddress(gaugeAddress)}
            chainId={chainId}
          />
        )
      case ActionType.Unstake:
        return (
          <WidgetUnstake
            vaultAddress={toAddress(vaultAddress)}
            gaugeAddress={toAddress(gaugeAddress)}
            chainId={chainId}
          />
        )
      case ActionType.DepositAndStake:
        return (
          <WidgetDepositAndStake
            vaultAddress={toAddress(vaultAddress)}
            gaugeAddress={toAddress(gaugeAddress)}
            assetAddress={toAddress(assetToken)}
            vaultType={vaultType}
            vaultVersion={vaultVersion}
            chainId={chainId}
            handleSuccess={handleSuccess}
          />
        )
      case ActionType.UnstakeAndWithdraw:
        return (
          <WidgetUnstakeAndWithdraw
            vaultAddress={toAddress(vaultAddress)}
            gaugeAddress={toAddress(gaugeAddress)}
            assetAddress={toAddress(assetToken)}
            vaultType={vaultType}
            vaultVersion={vaultVersion}
            chainId={chainId}
            handleSuccess={handleSuccess}
          />
        )
      case ActionType.EnsoDeposit:
        return (
          <WidgetEnsoDeposit
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            chainId={chainId}
            handleDepositSuccess={handleSuccess}
          />
        )
      case ActionType.EnsoWithdraw:
        return (
          <WidgetEnsoWithdraw
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            chainId={chainId}
            handleWithdrawSuccess={handleSuccess}
          />
        )
    }
  }, [mode, vaultAddress, gaugeAddress, vaultType, vaultVersion, assetToken, chainId, handleSuccess])

  return (
    <div className="flex flex-col gap-0 mt-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-100 rounded-lg flex h-12">
          {actions.map((action) => (
            <TabButton key={action} isActive={mode === action} onClick={() => setMode(action)}>
              {getActionLabel(action)}
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
