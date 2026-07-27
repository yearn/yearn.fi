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
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useImperativeHandle,
  useRef,
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
    requestKey?: number | string
  } | null
  onDepositPrefillConsumed?: () => void
  forceDepositStake?: boolean
  depositTitleOverride?: string
  onDepositUserTokenSelectionChange?: (address: TAddress, chainId: number) => void
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
    forceDepositStake,
    depositTitleOverride,
    onDepositUserTokenSelectionChange,
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

  // Render-time state adjustment: keep internal mode valid when actions change
  if (mode === undefined && !actions.includes(internalMode)) {
    setInternalMode(actions[0])
  }

  function renderSelectedComponent(): ReactElement {
    switch (currentMode) {
      case ActionType.Deposit:
        return (
          <WidgetDeposit
            vaultAddress={toAddress(vaultAddress)}
            assetAddress={toAddress(assetToken)}
            stakingAddress={resolvedStakingAddress}
            disableDepositStaking={disableDepositStaking}
            chainId={chainId}
            vaultAPR={vaultAPR?.forwardAPR?.netAPR || 0}
            vaultSymbol={vaultSymbol || ''}
            stakingSource={vaultStaking?.source}
            vaultUserData={vaultUserData}
            handleDepositSuccess={handleSuccess}
            prefill={depositPrefill ?? undefined}
            onPrefillApplied={onDepositPrefillConsumed}
            forceStake={forceDepositStake}
            titleOverride={depositTitleOverride}
            onUserTokenSelectionChange={onDepositUserTokenSelectionChange}
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
  onOpenRewards?: () => void
  isRewardsOpen?: boolean
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
  onOpenRewards,
  isRewardsOpen,
  onCloseOverlays,
  disableBorderRadius,
  dataTour,
  walletDataTour
}: WidgetTabsProps): ReactElement {
  const isWalletTabActive = !!isWalletOpen
  const isRewardsTabActive = !!isRewardsOpen
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const tabs = [
    ...actions.map((action) => ({
      id: action,
      isActive: !isWalletTabActive && !isRewardsTabActive && activeAction === action,
      label: getActionLabel(action),
      onSelect: (): void => onActionChange(action)
    })),
    ...(onOpenRewards
      ? [
          {
            id: 'rewards',
            isActive: isRewardsTabActive,
            label: 'Rewards',
            onSelect: onOpenRewards
          }
        ]
      : []),
    ...(onOpenWallet
      ? [
          {
            dataTour: walletDataTour,
            id: 'info',
            isActive: isWalletTabActive,
            label: 'My Info',
            onSelect: onOpenWallet
          }
        ]
      : [])
  ]
  const selectTab = (index: number, focus = false): void => {
    const tab = tabs[index]
    if (!tab) return
    onCloseOverlays?.()
    tab.onSelect()
    if (focus) tabRefs.current[index]?.focus()
  }
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : event.key === 'ArrowRight'
            ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft'
              ? (index - 1 + tabs.length) % tabs.length
              : undefined
    if (nextIndex === undefined) return
    event.preventDefault()
    selectTab(nextIndex, true)
  }

  return (
    <div
      className={cl('bg-surface-secondary border border-border gap-2 flex min-h-9 p-1', className, {
        'rounded-b-lg': !disableBorderRadius
      })}
      data-tour={dataTour}
      role="tablist"
      aria-label="Vault action"
    >
      {tabs.map((tab, index) => (
        <TabButton
          buttonRef={(element) => {
            tabRefs.current[index] = element
          }}
          dataTour={'dataTour' in tab ? tab.dataTour : undefined}
          isActive={tab.isActive}
          key={tab.id}
          onClick={() => selectTab(index)}
          onKeyDown={(event) => handleTabKeyDown(event, index)}
        >
          {tab.label}
        </TabButton>
      ))}
    </div>
  )
}

type TabButtonProps = {
  buttonRef?: (element: HTMLButtonElement | null) => void
  className?: string
  children: ReactNode
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  onClick: () => void
  isActive: boolean
  dataTour?: string
}

function TabButton({
  buttonRef,
  children,
  onClick,
  onKeyDown,
  isActive,
  className,
  dataTour
}: TabButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      data-tour={dataTour}
      ref={buttonRef}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
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
