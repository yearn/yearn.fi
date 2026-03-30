import {
  getVaultAPR,
  getVaultInfo,
  getVaultMigration,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  getVaultVersion,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { WidgetActionType as ActionType } from '@pages/vaults/types'
import type { TAddress } from '@shared/types'
import { cl, isZeroAddress, toAddress } from '@shared/utils'
import {
  type ForwardedRef,
  forwardRef,
  type ReactElement,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useState
} from 'react'
import { WidgetDeposit } from './deposit'
import { WidgetMigrate } from './migrate'
import { WidgetWithdraw } from './withdraw'

interface Props {
  currentVault: TKongVaultInput
  vaultAddress?: TAddress
  gaugeAddress?: TAddress
  disableDepositStaking?: boolean
  actions: ActionType[]
  chainId: number
  vaultUserData: VaultUserData
  handleSuccess?: () => void
  mode?: ActionType
  onModeChange?: (mode: ActionType) => void
  showTabs?: boolean
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  depositPrefill?: {
    address: TAddress
    chainId: number
    amount?: string
  } | null
  onDepositPrefillConsumed?: () => void
  hideTabSelector?: boolean
  disableBorderRadius?: boolean
  collapseDetails?: boolean
}

export type TWidgetRef = {
  setMode: (mode: ActionType) => void
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

export const Widget = forwardRef<TWidgetRef, Props>(function Widget(
  {
    currentVault,
    vaultAddress,
    gaugeAddress,
    disableDepositStaking,
    actions,
    chainId,
    vaultUserData,
    handleSuccess,
    mode,
    onModeChange,
    showTabs = true,
    onOpenSettings,
    isSettingsOpen,
    depositPrefill,
    onDepositPrefillConsumed,
    hideTabSelector,
    disableBorderRadius,
    collapseDetails
  }: Props,
  ref: ForwardedRef<TWidgetRef>
): ReactElement {
  const [internalMode, setInternalMode] = useState<ActionType>(actions[0])
  const currentMode = mode ?? internalMode
  const setMode = onModeChange ?? setInternalMode
  const assetToken = getVaultToken(currentVault).address
  const vaultAPR = getVaultAPR(currentVault)
  const vaultSymbol = getVaultSymbol(currentVault)
  const vaultStaking = getVaultStaking(currentVault)
  const vaultVersion = getVaultVersion(currentVault)
  const vaultInfo = getVaultInfo(currentVault)
  const vaultMigration = getVaultMigration(currentVault)
  const resolvedStakingAddress = isZeroAddress(gaugeAddress) ? undefined : toAddress(gaugeAddress)

  useImperativeHandle(ref, () => ({
    setMode(newMode: ActionType): void {
      if (actions.includes(newMode)) {
        setMode(newMode)
      }
    }
  }))

  useEffect(() => {
    if (mode === undefined) {
      setInternalMode(actions[0])
    }
  }, [actions, mode])

  function renderSelectedComponent(): ReactElement {
    switch (currentMode) {
      case ActionType.Deposit:
        return (
          <WidgetDeposit
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={disableDepositStaking ? undefined : resolvedStakingAddress}
            chainId={chainId}
            vaultAPR={vaultAPR?.forwardAPR?.netAPR || 0}
            vaultSymbol={vaultSymbol || ''}
            stakingSource={vaultStaking?.source}
            vaultUserData={vaultUserData}
            handleDepositSuccess={handleSuccess}
            prefill={depositPrefill ?? undefined}
            onPrefillApplied={onDepositPrefillConsumed}
            onOpenSettings={onOpenSettings}
            isSettingsOpen={isSettingsOpen}
            hideSettings={hideTabSelector}
            disableBorderRadius={disableBorderRadius}
            collapseDetails={collapseDetails}
          />
        )
      case ActionType.Withdraw:
        return (
          <WidgetWithdraw
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={resolvedStakingAddress}
            chainId={chainId}
            vaultSymbol={vaultSymbol || ''}
            stakingSource={vaultStaking?.source}
            vaultVersion={vaultVersion}
            isVaultRetired={Boolean(vaultInfo?.isRetired)}
            vaultUserData={vaultUserData}
            handleWithdrawSuccess={handleSuccess}
            onOpenSettings={onOpenSettings}
            isSettingsOpen={isSettingsOpen}
            hideSettings={hideTabSelector}
            disableBorderRadius={disableBorderRadius}
            collapseDetails={collapseDetails}
          />
        )
      case ActionType.Migrate:
        return (
          <WidgetMigrate
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={resolvedStakingAddress}
            chainId={chainId}
            vaultSymbol={vaultSymbol || ''}
            vaultVersion={vaultVersion}
            migrationTarget={toAddress(vaultMigration?.address)}
            migrationContract={toAddress(vaultMigration?.contract)}
            vaultUserData={vaultUserData}
            handleMigrateSuccess={handleSuccess}
          />
        )
    }
  }

  const selectedComponent = renderSelectedComponent()

  if (hideTabSelector) {
    return (
      <div className="flex flex-col gap-0 w-full h-full">
        <div
          className={cl('bg-surface relative w-full min-w-0', {
            'rounded-lg': !disableBorderRadius
          })}
        >
          {selectedComponent}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 w-full h-full flex-1">
      <div
        className={cl('bg-app overflow-hidden relative w-full min-w-0 flex flex-col flex-1', {
          'rounded-b-lg': !disableBorderRadius
        })}
      >
        {showTabs ? (
          <WidgetTabs
            actions={actions}
            activeAction={currentMode}
            onActionChange={setMode}
            disableBorderRadius={disableBorderRadius}
          />
        ) : null}
        <div className="bg-surface flex-1 flex flex-col [&>div]:flex-1 [&>div]:h-full">{selectedComponent}</div>
      </div>
    </div>
  )
})

type WidgetTabsProps = {
  actions: ActionType[]
  activeAction: ActionType
  onActionChange: (action: ActionType) => void
  className?: string
  onOpenWallet?: () => void
  isWalletOpen?: boolean
  onCloseOverlays?: () => void
  disableBorderRadius?: boolean
  dataTour?: string
  walletDataTour?: string
}

export function WidgetTabs({
  actions,
  activeAction,
  onActionChange,
  className,
  onOpenWallet,
  isWalletOpen,
  onCloseOverlays,
  disableBorderRadius,
  dataTour,
  walletDataTour
}: WidgetTabsProps): ReactElement {
  const isWalletTabActive = !!isWalletOpen

  return (
    <div
      className={cl('bg-surface-secondary border border-border gap-2 flex min-h-9 p-1', className, {
        'rounded-b-lg': !disableBorderRadius
      })}
      data-tour={dataTour}
    >
      {actions.map((action) => (
        <TabButton
          key={action}
          isActive={!isWalletTabActive && activeAction === action}
          onClick={() => {
            onCloseOverlays?.()
            onActionChange(action)
          }}
        >
          {getActionLabel(action)}
        </TabButton>
      ))}
      {onOpenWallet ? (
        <TabButton
          isActive={isWalletTabActive}
          onClick={() => {
            onCloseOverlays?.()
            onOpenWallet()
          }}
          dataTour={walletDataTour}
        >
          {'My Info'}
        </TabButton>
      ) : null}
    </div>
  )
}

type TabButtonProps = {
  className?: string
  children: ReactNode
  onClick: () => void
  isActive: boolean
  dataTour?: string
}

function TabButton({ children, onClick, isActive, className, dataTour }: TabButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={dataTour}
      className={cl(
        'flex-1 px-3 py-3 md:py-2.5 text-sm min-h-9 md:text-xs font-semibold transition-all duration-200',
        'border border-transparent focus-visible:outline-none focus-visible:ring-0',
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
