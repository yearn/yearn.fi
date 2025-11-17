import type { TAddress } from '@lib/types'
import { cl, isZeroAddress, toAddress } from '@lib/utils'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { WidgetActionType as ActionType } from '@nextgen/types'
import { type FC, useMemo, useState } from 'react'
import { type Address, erc4626Abi } from 'viem'
import { useReadContract } from 'wagmi'
import { WidgetDeposit } from './WidgetDeposit'
import { WidgetDepositAndStake } from './WidgetDepositAndStake'
import { WidgetDepositGeneric } from './WidgetDepositGeneric'
import { WidgetEnsoDeposit } from './WidgetEnsoDeposit'
import { WidgetEnsoWithdraw } from './WidgetEnsoWithdraw'
import { WidgetStake } from './WidgetStake'
import { WidgetUnstake } from './WidgetUnstake'
import { WidgetUnstakeAndWithdraw } from './WidgetUnstakeAndWithdraw'
import { WidgetWithdraw } from './WidgetWithdraw'
import { WidgetWithdrawGeneric } from './WidgetWithdrawGeneric'

interface Props {
  currentVault: TYDaemonVault
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
    case ActionType.DepositGeneric:
      return 'Deposit'
    case ActionType.WithdrawGeneric:
      return 'Withdraw'
    default:
      return action
  }
}

export const Widget: FC<Props> = ({
  currentVault,
  vaultAddress,
  gaugeAddress,
  vaultType,
  vaultVersion,
  actions,
  chainId,
  handleSuccess
}) => {
  const [mode, setMode] = useState<ActionType>(actions[0])

  const { data: assetToken, isLoading: isLoadingAsset } = useReadContract({
    address: vaultAddress as Address,
    abi: vaultType === 'v2' ? vaultAbi : erc4626Abi,
    functionName: vaultType === 'v2' ? 'token' : 'asset',
    chainId
  })

  const SelectedComponent = useMemo(() => {
    if (!assetToken || isLoadingAsset) {
      return (
        <div className="p-6 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )
    }
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
      case ActionType.DepositGeneric:
        return (
          <WidgetDepositGeneric
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={isZeroAddress(gaugeAddress) ? undefined : toAddress(gaugeAddress)}
            chainId={chainId}
            vaultAPR={currentVault?.apr?.forwardAPR?.netAPR || 0}
            vaultSymbol={currentVault?.symbol || ''}
            handleDepositSuccess={handleSuccess}
          />
        )
      case ActionType.WithdrawGeneric:
        return (
          <WidgetWithdrawGeneric
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={isZeroAddress(gaugeAddress) ? undefined : toAddress(gaugeAddress)}
            chainId={chainId}
            vaultSymbol={currentVault?.symbol || ''}
            vaultType={vaultType}
            handleWithdrawSuccess={handleSuccess}
          />
        )
    }
  }, [
    mode,
    vaultAddress,
    gaugeAddress,
    currentVault,
    vaultType,
    vaultVersion,
    assetToken,
    chainId,
    handleSuccess,
    isLoadingAsset
  ])

  return (
    <div className="flex flex-col gap-0 mt-4 w-full">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative w-full min-w-0">
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
