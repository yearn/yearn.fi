'use client'

import { WidgetDeposit } from '@yearn/vault-widget/internal/components/widget/deposit'
import { WidgetWithdraw } from '@yearn/vault-widget/internal/components/widget/withdraw'
import type { VaultWidgetProps, VaultWidgetRef, WidgetAddress } from '@yearn/vault-widget/types'
import { WidgetActionType } from '@yearn/vault-widget/types'
import type { ForwardedRef, ReactElement, ReactNode } from 'react'
import { forwardRef, useImperativeHandle, useState } from 'react'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' satisfies WidgetAddress

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

function resolveOptionalAddress(address?: WidgetAddress): WidgetAddress | undefined {
  return address && address.toLowerCase() !== ZERO_ADDRESS ? address : undefined
}

function getActionLabel(action: WidgetActionType): string {
  switch (action) {
    case WidgetActionType.Deposit:
      return 'Deposit'
    case WidgetActionType.Withdraw:
      return 'Withdraw'
    case WidgetActionType.Migrate:
      return 'Migrate'
  }
}

export const Widget = forwardRef<VaultWidgetRef, VaultWidgetProps>(function Widget(
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
    withdrawalSource,
    renderAction
  },
  ref: ForwardedRef<VaultWidgetRef>
): ReactElement {
  const [internalMode, setInternalMode] = useState<WidgetActionType>(actions[0] ?? WidgetActionType.Deposit)
  const fallbackMode = actions.includes(internalMode) ? internalMode : (actions[0] ?? WidgetActionType.Deposit)
  const currentMode = mode ?? fallbackMode
  const setMode = onModeChange ?? setInternalMode
  const resolvedVaultAddress = vaultAddress ?? currentVault.address
  const resolvedStakingAddress = resolveOptionalAddress(gaugeAddress ?? currentVault.staking?.address)

  useImperativeHandle(ref, () => ({
    setMode(nextMode: WidgetActionType): void {
      if (actions.includes(nextMode)) {
        setMode(nextMode)
      }
    }
  }))

  const selectedComponent: ReactNode = (() => {
    switch (currentMode) {
      case WidgetActionType.Deposit:
        return (
          <WidgetDeposit
            vaultAddress={resolvedVaultAddress}
            assetAddress={currentVault.asset.address}
            stakingAddress={resolvedStakingAddress}
            disableDepositStaking={disableDepositStaking}
            chainId={chainId}
            vaultAPR={currentVault.forwardAPR}
            vaultSymbol={currentVault.symbol}
            stakingSource={currentVault.staking?.source}
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
            disableTokenSelector={disableTokenSelector}
          />
        )
      case WidgetActionType.Withdraw:
        return (
          <WidgetWithdraw
            vaultAddress={resolvedVaultAddress}
            assetAddress={currentVault.asset.address}
            stakingAddress={resolvedStakingAddress}
            chainId={chainId}
            vaultSymbol={currentVault.symbol}
            stakingSource={currentVault.staking?.source}
            vaultVersion={currentVault.version}
            isVaultRetired={currentVault.isRetired}
            vaultUserData={vaultUserData}
            handleWithdrawSuccess={handleSuccess}
            onOpenSettings={onOpenSettings}
            isSettingsOpen={isSettingsOpen}
            hideSettings={hideTabSelector}
            disableBorderRadius={disableBorderRadius}
            collapseDetails={collapseDetails}
            disableTokenSelector={disableTokenSelector}
            forcedWithdrawalSource={withdrawalSource}
          />
        )
      case WidgetActionType.Migrate:
        return renderAction?.(WidgetActionType.Migrate) ?? null
    }
  })()

  if (hideTabSelector) {
    return (
      <div className="flex flex-col gap-0 w-full h-full">
        <div className={classes('bg-surface relative w-full min-w-0', !disableBorderRadius && 'rounded-lg')}>
          {selectedComponent}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 w-full h-full flex-1">
      <div
        className={classes(
          'bg-app overflow-hidden relative w-full min-w-0 flex flex-col flex-1',
          !disableBorderRadius && 'rounded-b-lg'
        )}
        data-widget-part="action-shell"
      >
        {showTabs ? (
          <WidgetTabs
            actions={actions}
            activeAction={currentMode}
            onActionChange={setMode}
            disableBorderRadius={disableBorderRadius}
          />
        ) : null}
        <div className="bg-surface flex-1 flex flex-col [&>div]:flex-1 [&>div]:h-full" data-widget-part="action-panel">
          {selectedComponent}
        </div>
      </div>
    </div>
  )
})

export type WidgetTabsProps = {
  actions: WidgetActionType[]
  activeAction: WidgetActionType
  onActionChange: (action: WidgetActionType) => void
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
  return (
    <div
      className={classes(
        'bg-surface-secondary border border-border gap-2 flex min-h-9 p-1',
        className,
        !disableBorderRadius && 'rounded-b-lg'
      )}
      data-widget-part="action-tabs"
      data-tour={dataTour}
    >
      {actions.map((action) => (
        <TabButton
          key={action}
          action={action}
          isActive={!isWalletOpen && activeAction === action}
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
          action="wallet"
          isActive={Boolean(isWalletOpen)}
          onClick={() => {
            onCloseOverlays?.()
            onOpenWallet()
          }}
          dataTour={walletDataTour}
        >
          My Info
        </TabButton>
      ) : null}
    </div>
  )
}

type TabButtonProps = {
  action: WidgetActionType | 'wallet'
  className?: string
  children: ReactNode
  onClick: () => void
  isActive: boolean
  dataTour?: string
}

function TabButton({ action, children, onClick, isActive, className, dataTour }: TabButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      data-action={action}
      data-state={isActive ? 'active' : 'inactive'}
      data-widget-part="action-tab"
      data-tour={dataTour}
      className={classes(
        'flex-1 px-3 py-3 md:py-2.5 text-sm min-h-9 md:text-xs font-semibold transition-all duration-200',
        'border border-transparent focus-visible:outline-none focus-visible:ring-0 rounded-md',
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
