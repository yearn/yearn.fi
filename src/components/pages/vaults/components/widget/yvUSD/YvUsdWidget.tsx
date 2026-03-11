import type { TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { WidgetActionType as ActionType } from '@pages/vaults/types'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'
import { YvUsdDeposit } from './YvUsdDeposit'
import { YvUsdWithdraw } from './YvUsdWithdraw'

interface Props {
  currentVault: TKongVaultView
  chainId: number
  handleSuccess?: () => void
  mode?: ActionType
  onModeChange?: (mode: ActionType) => void
  showTabs?: boolean
  collapseDetails?: boolean
}

export function YvUsdWidget({
  currentVault,
  chainId,
  handleSuccess,
  mode: controlledMode,
  onModeChange,
  showTabs = true,
  collapseDetails
}: Props): ReactElement {
  const [internalMode, setInternalMode] = useState<ActionType>(ActionType.Deposit)
  const mode = controlledMode ?? internalMode
  const setMode = onModeChange ?? setInternalMode
  const selectedComponent = renderSelectedComponent({
    mode,
    chainId,
    assetAddress: currentVault.token.address,
    handleSuccess,
    collapseDetails
  })

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
  collapseDetails?: boolean
}

function renderSelectedComponent({
  mode,
  chainId,
  assetAddress,
  handleSuccess,
  collapseDetails
}: RenderSelectedComponentParams): ReactElement | null {
  switch (mode) {
    case ActionType.Deposit:
      return (
        <YvUsdDeposit
          chainId={chainId}
          assetAddress={assetAddress}
          onDepositSuccess={handleSuccess}
          collapseDetails={collapseDetails}
        />
      )
    case ActionType.Withdraw:
      return (
        <YvUsdWithdraw
          chainId={chainId}
          assetAddress={assetAddress}
          onWithdrawSuccess={handleSuccess}
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
