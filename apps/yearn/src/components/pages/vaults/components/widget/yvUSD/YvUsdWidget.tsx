import { YvUsdDeposit } from '@pages/vaults/components/widget/yvUSD/YvUsdDeposit'
import { YvUsdMigrate } from '@pages/vaults/components/widget/yvUSD/YvUsdMigrate'
import { YvUsdWithdraw } from '@pages/vaults/components/widget/yvUSD/YvUsdWithdraw'
import type { TTranchedProductKind } from '@pages/vaults/constants/tranchedProducts'
import type { TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { WidgetActionType as ActionType } from '@pages/vaults/types'
import type { TYvUsdVariant } from '@pages/vaults/utils/yvUsd'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'

interface Props {
  currentVault: TKongVaultView
  chainId: number
  actions: ActionType[]
  handleSuccess?: () => void
  mode?: ActionType
  onModeChange?: (mode: ActionType) => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  showTabs?: boolean
  collapseDetails?: boolean
  onDepositVariantChange?: (variant: TYvUsdVariant) => void
}

export function YvUsdWidget({
  currentVault,
  chainId,
  actions,
  handleSuccess,
  mode: controlledMode,
  onModeChange,
  onOpenSettings,
  isSettingsOpen,
  showTabs = true,
  collapseDetails,
  onDepositVariantChange
}: Props): ReactElement {
  const [internalMode, setInternalMode] = useState<ActionType>(actions[0])
  const [migrationDestination, setMigrationDestination] = useState<TTranchedProductKind>('senior')
  const [withdrawVariant, setWithdrawVariant] = useState<TYvUsdVariant>()
  const mode = controlledMode ?? internalMode
  const setMode = onModeChange ?? setInternalMode
  const selectedComponent =
    mode === ActionType.Migrate ? (
      <YvUsdMigrate
        currentVault={currentVault}
        chainId={chainId}
        destination={migrationDestination}
        onDestinationChange={setMigrationDestination}
        onUnlock={() => {
          setWithdrawVariant('locked')
          setMode(ActionType.Withdraw)
        }}
        onMigrateSuccess={handleSuccess}
      />
    ) : (
      renderSelectedComponent({
        mode,
        chainId,
        assetAddress: currentVault.token.address,
        handleSuccess,
        onOpenSettings,
        isSettingsOpen,
        collapseDetails,
        onDepositVariantChange,
        withdrawVariant
      })
    )

  return (
    <div className="flex flex-col gap-0 w-full h-full">
      <div className="bg-surface rounded-lg border border-border overflow-hidden relative w-full min-w-0">
        {showTabs ? (
          <div className="bg-surface rounded-lg flex h-11">
            {actions.map((action) => (
              <TabButton key={action} isActive={mode === action} onClick={() => setMode(action)}>
                {action === ActionType.Migrate ? 'Migrate' : action === ActionType.Deposit ? 'Deposit' : 'Withdraw'}
              </TabButton>
            ))}
          </div>
        ) : null}
        {selectedComponent}
      </div>
    </div>
  )
}

type RenderSelectedComponentParams = {
  mode: ActionType
  chainId: number
  assetAddress: `0x${string}`
  handleSuccess?: () => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  collapseDetails?: boolean
  onDepositVariantChange?: (variant: TYvUsdVariant) => void
  withdrawVariant?: TYvUsdVariant
}

function renderSelectedComponent({
  mode,
  chainId,
  assetAddress,
  handleSuccess,
  onOpenSettings,
  isSettingsOpen,
  collapseDetails,
  onDepositVariantChange,
  withdrawVariant
}: RenderSelectedComponentParams): ReactElement | null {
  switch (mode) {
    case ActionType.Deposit:
      return (
        <YvUsdDeposit
          chainId={chainId}
          assetAddress={assetAddress}
          onDepositSuccess={handleSuccess}
          onOpenSettings={onOpenSettings}
          isSettingsOpen={isSettingsOpen}
          collapseDetails={collapseDetails}
          onVariantChange={onDepositVariantChange}
        />
      )
    case ActionType.Withdraw:
      return (
        <YvUsdWithdraw
          initialVariant={withdrawVariant}
          chainId={chainId}
          assetAddress={assetAddress}
          onWithdrawSuccess={handleSuccess}
          onOpenSettings={onOpenSettings}
          isSettingsOpen={isSettingsOpen}
          collapseDetails={collapseDetails}
        />
      )
    default:
      return null
  }
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
