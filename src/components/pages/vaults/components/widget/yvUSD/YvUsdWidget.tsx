import type { TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { WidgetActionType as ActionType } from '@pages/vaults/types'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { YvUsdDeposit } from './YvUsdDeposit'
import { YvUsdWithdraw } from './YvUsdWithdraw'

interface Props {
  currentVault: TKongVaultView
  chainId: number
  handleSuccess?: () => void
  mode?: ActionType
  onModeChange?: (mode: ActionType) => void
  showTabs?: boolean
}

export function YvUsdWidget({
  currentVault,
  chainId,
  handleSuccess,
  mode: controlledMode,
  onModeChange,
  showTabs = true
}: Props): ReactElement {
  const [internalMode, setInternalMode] = useState<ActionType>(ActionType.Deposit)
  const mode = controlledMode ?? internalMode
  const setMode = onModeChange ?? setInternalMode

  const SelectedComponent = useMemo<ReactElement | null>(() => {
    switch (mode) {
      case ActionType.Deposit:
        return (
          <YvUsdDeposit chainId={chainId} assetAddress={currentVault.token.address} onDepositSuccess={handleSuccess} />
        )
      case ActionType.Withdraw:
        return (
          <YvUsdWithdraw
            chainId={chainId}
            assetAddress={currentVault.token.address}
            onWithdrawSuccess={handleSuccess}
          />
        )
      default:
        return null
    }
  }, [mode, chainId, currentVault.token.address, handleSuccess])

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
        {SelectedComponent}
      </div>
    </div>
  )
}

const TabButton = ({
  children,
  onClick,
  isActive
}: {
  children: ReactNode
  onClick: () => void
  isActive: boolean
}) => {
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
