import { WidgetActionType as ActionType } from '@pages/vaults/types'
import type { TAddress } from '@shared/types'
import { cl, isZeroAddress, toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { type FC, useMemo, useState } from 'react'
import { WidgetDeposit } from './deposit'
import { WidgetMigrate } from './migrate'
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
    case ActionType.Migrate:
      return 'Migrate'
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
      case ActionType.Migrate:
        return (
          <WidgetMigrate
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={isZeroAddress(gaugeAddress) ? undefined : toAddress(gaugeAddress)}
            chainId={chainId}
            vaultSymbol={currentVault?.symbol || ''}
            vaultVersion={currentVault?.version}
            migrationTarget={toAddress(currentVault?.migration?.address)}
            migrationContract={toAddress(currentVault?.migration?.contract)}
            handleMigrateSuccess={handleSuccess}
          />
        )
    }
  }, [mode, vaultAddress, gaugeAddress, currentVault, assetToken, chainId, handleSuccess])

  return (
    <div className="flex flex-col gap-0 w-full h-full">
      <div className="bg-app rounded-b-lg overflow-hidden relative w-full min-w-0">
        <div className="bg-surface-secondary border-b border-x border-border rounded-b-lg flex min-h-9 mb-4 p-1">
          {actions.map((action) => (
            <TabButton key={action} isActive={mode === action} onClick={() => setMode(action)}>
              {getActionLabel(action)}
            </TabButton>
          ))}
        </div>
        <div className="bg-surface">{SelectedComponent}</div>
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
        'flex-1 px-3 py-3 md:py-2.5 text-sm min-h-9 md:text-xs font-semibold transition-all duration-200',
        // 'min-h-[44px] active:scale-[0.98]',
        'rounded-md ',
        isActive
          ? 'bg-surface text-text-primary border border-border'
          : 'bg-surface-secondary text-text-secondary hover:text-text-primary',
        className
      )}
    >
      {children}
    </button>
  )
}
