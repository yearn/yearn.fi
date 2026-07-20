import { WidgetMigrate } from '@pages/vaults/components/widget/migrate'
import {
  normalizeVaultForWidget,
  normalizeVaultUserDataForWidget
} from '@pages/vaults/components/widget/vaultWidgetAdapter'
import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { WidgetActionType as ActionType } from '@pages/vaults/types'
import type { TAddress } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import {
  WidgetActionType as SharedActionType,
  Widget as SharedVaultWidget,
  WidgetTabs as SharedWidgetTabs,
  type TWidgetRef as TSharedWidgetRef
} from '@yearn/vault-widget'
import { type ForwardedRef, forwardRef, type ReactElement, useImperativeHandle, useMemo, useRef } from 'react'

export interface VaultWidgetProps {
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
  disableTokenSelector?: boolean
  withdrawalSource?: 'vault' | 'staking'
}

export type TWidgetRef = {
  setMode: (mode: ActionType) => void
}

const toSharedAction = (action: ActionType): SharedActionType => {
  switch (action) {
    case ActionType.Deposit:
      return SharedActionType.Deposit
    case ActionType.Withdraw:
      return SharedActionType.Withdraw
    case ActionType.Migrate:
      return SharedActionType.Migrate
  }
}

const toYearnAction = (action: SharedActionType): ActionType => {
  switch (action) {
    case SharedActionType.Deposit:
      return ActionType.Deposit
    case SharedActionType.Withdraw:
      return ActionType.Withdraw
    case SharedActionType.Migrate:
      return ActionType.Migrate
  }
}

const resolveOptionalAddress = (address?: TAddress): TAddress | undefined => {
  return address && !isZeroAddress(address) ? toAddress(address) : undefined
}

export const Widget = forwardRef<TWidgetRef, VaultWidgetProps>(function Widget(
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
    collapseDetails,
    disableTokenSelector,
    withdrawalSource
  }: VaultWidgetProps,
  ref: ForwardedRef<TWidgetRef>
): ReactElement {
  const sharedWidgetRef = useRef<TSharedWidgetRef>(null)
  const normalizedVault = useMemo(() => normalizeVaultForWidget(currentVault), [currentVault])
  const normalizedUserData = useMemo(
    () => normalizeVaultUserDataForWidget(vaultUserData, chainId),
    [chainId, vaultUserData]
  )
  const sharedActions = useMemo(() => actions.map(toSharedAction), [actions])
  const resolvedVaultAddress = toAddress(vaultAddress ?? normalizedVault.address)
  const resolvedStakingAddress = resolveOptionalAddress(gaugeAddress ?? normalizedVault.staking?.address)

  useImperativeHandle(ref, () => ({
    setMode(newMode: ActionType): void {
      sharedWidgetRef.current?.setMode(toSharedAction(newMode))
    }
  }))

  return (
    <SharedVaultWidget
      ref={sharedWidgetRef}
      currentVault={normalizedVault}
      vaultAddress={resolvedVaultAddress}
      gaugeAddress={resolvedStakingAddress}
      disableDepositStaking={disableDepositStaking}
      actions={sharedActions}
      chainId={chainId}
      vaultUserData={normalizedUserData}
      handleSuccess={handleSuccess}
      mode={mode === undefined ? undefined : toSharedAction(mode)}
      onModeChange={onModeChange ? (nextMode) => onModeChange(toYearnAction(nextMode)) : undefined}
      showTabs={showTabs}
      onOpenSettings={onOpenSettings}
      isSettingsOpen={isSettingsOpen}
      depositPrefill={depositPrefill}
      onDepositPrefillConsumed={onDepositPrefillConsumed}
      forceDepositStake={forceDepositStake}
      depositTitleOverride={depositTitleOverride}
      onDepositUserTokenSelectionChange={onDepositUserTokenSelectionChange}
      hideTabSelector={hideTabSelector}
      disableBorderRadius={disableBorderRadius}
      collapseDetails={collapseDetails}
      disableTokenSelector={disableTokenSelector}
      withdrawalSource={withdrawalSource}
      renderAction={(action) => {
        if (action !== SharedActionType.Migrate) {
          return null
        }

        return (
          <WidgetMigrate
            vaultAddress={resolvedVaultAddress}
            assetAddress={normalizedVault.asset.address}
            stakingAddress={resolvedStakingAddress}
            chainId={chainId}
            vaultSymbol={normalizedVault.symbol}
            vaultVersion={normalizedVault.version}
            migrationTarget={toAddress(normalizedVault.migration?.address)}
            migrationContract={toAddress(normalizedVault.migration?.contract)}
            vaultUserData={vaultUserData}
            handleMigrateSuccess={handleSuccess}
          />
        )
      }}
    />
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

export function WidgetTabs({ actions, activeAction, onActionChange, ...props }: WidgetTabsProps): ReactElement {
  return (
    <SharedWidgetTabs
      {...props}
      actions={actions.map(toSharedAction)}
      activeAction={toSharedAction(activeAction)}
      onActionChange={(action) => onActionChange(toYearnAction(action))}
    />
  )
}
