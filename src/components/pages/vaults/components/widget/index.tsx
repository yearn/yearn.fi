import { WidgetActionType as ActionType } from '@pages/vaults/types'
import { IconSettings } from '@shared/icons/IconSettings'
import type { TAddress } from '@shared/types'
import { cl, isZeroAddress, toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { type FC, useEffect, useMemo, useState } from 'react'
import { WidgetDeposit } from './deposit'
import { WidgetMigrate } from './migrate'
import { SettingsOverlay } from './SettingsOverlay'
import { WidgetWithdraw } from './withdraw'

interface Props {
  currentVault: TYDaemonVault
  vaultAddress?: TAddress
  gaugeAddress?: TAddress
  actions: ActionType[]
  chainId: number
  handleSuccess?: () => void
  mode?: ActionType
  onModeChange?: (mode: ActionType) => void
  showTabs?: boolean
  isSettingsOpen?: boolean
  onSettingsOpenChange?: (isOpen: boolean) => void
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

export const Widget: FC<Props> = ({
  currentVault,
  vaultAddress,
  gaugeAddress,
  actions,
  chainId,
  handleSuccess,
  mode,
  onModeChange,
  showTabs = true,
  isSettingsOpen,
  onSettingsOpenChange
}) => {
  const [internalMode, setInternalMode] = useState<ActionType>(actions[0])
  const currentMode = mode ?? internalMode
  const setMode = onModeChange ?? setInternalMode
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false)
  const settingsOpen = isSettingsOpen ?? internalSettingsOpen
  const setSettingsOpen = onSettingsOpenChange ?? setInternalSettingsOpen
  const assetToken = currentVault.token.address

  useEffect(() => {
    if (mode === undefined) {
      setInternalMode(actions[0])
    }
  }, [actions, mode])

  const SelectedComponent = useMemo(() => {
    switch (currentMode) {
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
  }, [currentMode, vaultAddress, gaugeAddress, currentVault, assetToken, chainId, handleSuccess])

  return (
    <div className="flex flex-col gap-0 w-full h-full flex-1">
      <div className="bg-app rounded-b-lg overflow-hidden relative w-full min-w-0 flex flex-col flex-1">
        {showTabs ? (
          <WidgetTabs
            actions={actions}
            activeAction={currentMode}
            onActionChange={setMode}
            onOpenSettings={() => setSettingsOpen(!settingsOpen)}
            isSettingsOpen={settingsOpen}
          />
        ) : null}
        <div className="bg-surface flex-1 flex flex-col [&>div]:flex-1 [&>div]:h-full">{SelectedComponent}</div>
        <SettingsOverlay isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </div>
  )
}

export const WidgetTabs: FC<{
  actions: ActionType[]
  activeAction: ActionType
  onActionChange: (action: ActionType) => void
  className?: string
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
}> = ({ actions, activeAction, onActionChange, className, onOpenSettings, isSettingsOpen }) => {
  return (
    <div className={cl('bg-surface-secondary border border-border rounded-b-lg gap-2 flex min-h-9 p-1', className)}>
      {actions.map((action) => (
        <TabButton
          key={action}
          isActive={activeAction === action}
          onClick={() => {
            if (isSettingsOpen && onOpenSettings) {
              onOpenSettings()
            }
            onActionChange(action)
          }}
        >
          {getActionLabel(action)}
        </TabButton>
      ))}
      {onOpenSettings ? (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open widget settings"
          aria-pressed={isSettingsOpen}
          className={cl(
            'flex items-center justify-center rounded-md border border-transparent px-2.5 py-2 text-text-secondary transition-all duration-200',
            'min-h-9',
            isSettingsOpen
              ? 'bg-surface text-text-primary !border-border'
              : 'bg-surface-secondary hover:bg-surface hover:text-text-primary'
          )}
        >
          <IconSettings className="h-4 w-4" />
        </button>
      ) : null}
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
        'border border-transparent focus-visible:outline-none focus-visible:ring-0',
        // 'min-h-[44px] active:scale-[0.98]',
        'rounded-md ',
        isActive
          ? 'bg-surface text-text-primary !border-border'
          : 'bg-surface-secondary text-text-secondary hover:text-text-primary',
        className
      )}
    >
      {children}
    </button>
  )
}
