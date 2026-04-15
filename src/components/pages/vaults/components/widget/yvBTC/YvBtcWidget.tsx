import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvBtcVaults } from '@pages/vaults/hooks/useYvBtcVaults'
import { WidgetActionType as ActionType } from '@pages/vaults/types'
import type { TYvUsdVariant } from '@pages/vaults/utils/yvUsd'
import { Button } from '@shared/components/Button'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { WidgetDeposit } from '../deposit'
import { WidgetWithdraw } from '../withdraw'
import { YvUsdVariantToggle } from '../yvUSD/YvUsdVariantToggle'

interface Props {
  chainId: number
  mode?: ActionType
  onModeChange?: (mode: ActionType) => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  showTabs?: boolean
  collapseDetails?: boolean
  handleSuccess?: () => void
  onVariantChange?: (variant: TYvUsdVariant) => void
}

export function YvBtcWidget({
  chainId,
  mode: controlledMode,
  onModeChange,
  onOpenSettings,
  isSettingsOpen,
  showTabs = true,
  collapseDetails,
  handleSuccess,
  onVariantChange
}: Props): ReactElement {
  const [internalMode, setInternalMode] = useState<ActionType>(ActionType.Deposit)
  const mode = controlledMode ?? internalMode
  const setMode = onModeChange ?? setInternalMode

  return (
    <div className="flex flex-col gap-0 w-full h-full">
      <div className="bg-surface rounded-lg border border-border overflow-hidden relative w-full min-w-0">
        {showTabs ? (
          <div className="bg-surface rounded-lg flex h-11">
            {[ActionType.Deposit, ActionType.Withdraw].map((action) => (
              <TabButton key={action} isActive={mode === action} onClick={() => setMode(action)}>
                {action === ActionType.Deposit ? 'Deposit' : 'Withdraw'}
              </TabButton>
            ))}
          </div>
        ) : null}
        <YvBtcWidgetBody
          mode={mode}
          chainId={chainId}
          handleSuccess={handleSuccess}
          onOpenSettings={onOpenSettings}
          isSettingsOpen={isSettingsOpen}
          collapseDetails={collapseDetails}
          onVariantChange={onVariantChange}
        />
      </div>
    </div>
  )
}

function YvBtcWidgetBody({
  mode,
  chainId,
  handleSuccess,
  onOpenSettings,
  isSettingsOpen,
  collapseDetails,
  onVariantChange
}: {
  mode: ActionType
  chainId: number
  handleSuccess?: () => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  collapseDetails?: boolean
  onVariantChange?: (variant: TYvUsdVariant) => void
}): ReactElement | null {
  const { address: account } = useAccount()
  const { unlockedVault, metrics, isLoading } = useYvBtcVaults()
  const [variant, setVariant] = useState<TYvUsdVariant>('unlocked')
  const isLockedVariant = variant === 'locked'
  const assetAddress = unlockedVault?.token.address
  const unlockedUserData = useVaultUserData({
    vaultAddress: unlockedVault?.address,
    assetAddress,
    chainId,
    account
  })

  const handleVariantChange = (nextVariant: TYvUsdVariant): void => {
    setVariant(nextVariant)
    onVariantChange?.(nextVariant)
  }

  const headerActions = <YvUsdVariantToggle activeVariant={variant} onChange={handleVariantChange} />

  if (isLoading || !unlockedVault || !assetAddress) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (isLockedVariant) {
    return <YvBtcLockedPlaceholder mode={mode} headerActions={headerActions} />
  }

  if (mode === ActionType.Deposit) {
    return (
      <WidgetDeposit
        vaultAddress={unlockedVault.address}
        assetAddress={assetAddress}
        chainId={chainId}
        vaultAPR={metrics.unlocked.apy}
        vaultSymbol={'yvBTC (Unlocked)'}
        vaultUserData={unlockedUserData}
        handleDepositSuccess={handleSuccess}
        onOpenSettings={onOpenSettings}
        isSettingsOpen={isSettingsOpen}
        hideContainerBorder
        headerActions={headerActions}
        contentAboveButton={<YvBtcUnlockedNotice mode={mode} />}
        actionLabelOverride={'Deposit to Unlocked'}
        collapseDetails={Boolean(collapseDetails)}
        vaultSharesLabel={'Unlocked Vault Shares'}
      />
    )
  }

  if (mode === ActionType.Withdraw) {
    return (
      <WidgetWithdraw
        vaultAddress={unlockedVault.address}
        assetAddress={assetAddress}
        chainId={chainId}
        vaultSymbol={'yvBTC (Unlocked)'}
        vaultVersion={unlockedVault.version}
        vaultUserData={unlockedUserData}
        handleWithdrawSuccess={handleSuccess}
        onOpenSettings={onOpenSettings}
        isSettingsOpen={isSettingsOpen}
        hideContainerBorder
        headerActions={headerActions}
        contentBelowInput={<YvBtcUnlockedNotice mode={mode} />}
        collapseDetails={Boolean(collapseDetails)}
      />
    )
  }

  return null
}

function YvBtcUnlockedNotice({ mode }: { mode: ActionType }): ReactElement {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary">
      <p className="text-sm text-primary">
        {mode === ActionType.Deposit
          ? 'Unlocked yvBTC deposits stay liquid. The locked yvBTC contract is not live yet.'
          : 'Unlocked yvBTC withdrawals are available. Locked yvBTC withdrawals will be enabled once the locked contract is live.'}
      </p>
    </div>
  )
}

function YvBtcLockedPlaceholder({ mode, headerActions }: { mode: ActionType; headerActions: ReactNode }): ReactElement {
  const actionLabel = mode === ActionType.Deposit ? 'Deposit to Locked' : 'Withdraw from Locked'

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {mode === ActionType.Deposit ? 'Deposit' : 'Withdraw'}
          </p>
          <p className="text-xs text-text-secondary">{'Select yvBTC variant'}</p>
        </div>
        {headerActions}
      </div>
      <div className="rounded-lg border border-border bg-surface-secondary px-3 py-3 text-sm text-text-primary">
        <p className="font-semibold text-text-primary">{'Locked yvBTC is not live yet.'}</p>
        <p className="mt-1 text-text-secondary">
          {'This page is wired for the dual-vault launch, but the locked vault address is still a placeholder.'}
        </p>
      </div>
      <Button isDisabled className="w-full">
        {actionLabel}
      </Button>
    </div>
  )
}

type TabButtonProps = {
  children: ReactNode
  onClick: () => void
  isActive: boolean
}

function TabButton({ children, onClick, isActive }: TabButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cl(
        'flex-1 px-3 py-2 text-xs font-semibold transition-all duration-200',
        isActive
          ? 'bg-surface text-text-primary rounded-bl-none rounded-br-none'
          : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
      )}
    >
      {children}
    </button>
  )
}
