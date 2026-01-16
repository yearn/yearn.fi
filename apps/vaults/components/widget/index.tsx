import type { TAddress } from '@lib/types'
import { cl, isZeroAddress, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { WidgetActionType as ActionType } from '@vaults/types'
import { type FC, useMemo, useState } from 'react'
import { WidgetDeposit } from './deposit'
import { WidgetWithdraw } from './withdraw'

interface Props {
  currentVault: TYDaemonVault
  vaultAddress?: TAddress
  gaugeAddress?: TAddress
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
  }
}

export const Widget: FC<Props> = ({ currentVault, vaultAddress, gaugeAddress, actions, chainId, handleSuccess }) => {
  const [mode, setMode] = useState<ActionType>(actions[0])
  const assetToken = currentVault.token.address

  const SelectedComponent = useMemo(() => {
    switch (mode) {
      case ActionType.Deposit:
        return (
          <WidgetDeposit
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={isZeroAddress(gaugeAddress) ? undefined : toAddress(gaugeAddress)}
            chainId={chainId}
            vaultAPR={currentVault?.apr?.forwardAPR?.netAPR || 0}
            vaultSymbol={currentVault?.symbol || ''}
            stakingSource={currentVault?.staking?.source}
            handleDepositSuccess={handleSuccess}
          />
        )
      case ActionType.Withdraw:
        return (
          <WidgetWithdraw
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={isZeroAddress(gaugeAddress) ? undefined : toAddress(gaugeAddress)}
            chainId={chainId}
            vaultSymbol={currentVault?.symbol || ''}
            handleWithdrawSuccess={handleSuccess}
          />
        )
    }
  }, [mode, vaultAddress, gaugeAddress, currentVault, assetToken, chainId, handleSuccess])

  return (
    <div className="flex flex-col gap-0 w-full h-full">
      <div className="bg-surface rounded-lg border border-border overflow-hidden relative w-full min-w-0">
        <div className="bg-surface rounded-lg flex h-11">
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
        'flex-1 px-3 py-2 text-xs font-semibold transition-all duration-200',
        isActive
          ? 'bg-surface text-text-primary rounded-bl-none rounded-br-none'
          : 'bg-surface-secondary text-text-secondary hover:text-text-primary',
        className
      )}
    >
      {children}
    </button>
  )
}
