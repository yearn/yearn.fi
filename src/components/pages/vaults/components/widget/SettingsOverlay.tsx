import { useYearn } from '@shared/contexts/useYearn'
import { cl } from '@shared/utils'
import { type FC, useCallback, useEffect, useId, useState } from 'react'
import { InfoOverlay } from './shared/InfoOverlay'

type SettingsOverlayProps = {
  isOpen: boolean
  onClose: () => void
}

export const SettingsOverlay: FC<SettingsOverlayProps> = ({ isOpen, onClose }) => {
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled } = useYearn()
  const [localSlippage, setLocalSlippage] = useState(zapSlippage)
  const slippageId = useId()
  const maximizeYieldId = useId()

  useEffect(() => {
    if (isOpen) {
      setLocalSlippage(zapSlippage)
    }
  }, [isOpen, zapSlippage])

  const handleClose = useCallback(() => {
    if (localSlippage !== zapSlippage) {
      setZapSlippage(localSlippage)
    }
    onClose()
  }, [localSlippage, onClose, setZapSlippage, zapSlippage])

  return (
    <InfoOverlay isOpen={isOpen} onClose={handleClose} title="Transaction Settings" hideButton>
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={slippageId} className="text-sm text-text-primary">
                Slippage Tolerance
              </label>
              <span className="text-sm text-text-secondary">{localSlippage}%</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLocalSlippage(0.1)}
                className={cl(
                  'px-3 py-1.5 text-xs rounded-md border transition-colors',
                  localSlippage === 0.1
                    ? 'bg-surface-tertiary text-text-primary border-surface-tertiary'
                    : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                )}
              >
                0.1%
              </button>
              <button
                onClick={() => setLocalSlippage(0.5)}
                className={cl(
                  'px-3 py-1.5 text-xs rounded-md border transition-colors',
                  localSlippage === 0.5
                    ? 'bg-surface-tertiary text-text-primary border-surface-tertiary'
                    : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                )}
              >
                0.5%
              </button>
              <button
                onClick={() => setLocalSlippage(1.0)}
                className={cl(
                  'px-3 py-1.5 text-xs rounded-md border transition-colors',
                  localSlippage === 1.0
                    ? 'bg-surface-tertiary text-text-primary border-surface-tertiary'
                    : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                )}
              >
                1.0%
              </button>
              <input
                id={slippageId}
                type="number"
                value={localSlippage}
                onChange={(e) => setLocalSlippage(Number.parseFloat(e.target.value) || 0)}
                className="w-16 px-2 py-1.5 text-xs border border-border text-text-primary bg-surface text-right rounded-md"
                step="0.1"
                min="0"
                max="50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="space-y-0.5">
              <label htmlFor={maximizeYieldId} className="text-sm text-text-primary">
                Maximize Yield
              </label>
              <p className="text-xs text-text-secondary">Automatically stake to maximize APY.</p>
              <p className="text-xs text-text-secondary">No assets will be locked.</p>
            </div>
            <button
              id={maximizeYieldId}
              role="switch"
              aria-checked={isAutoStakingEnabled}
              onClick={() => setIsAutoStakingEnabled(!isAutoStakingEnabled)}
              className={cl(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                isAutoStakingEnabled ? 'bg-blue-600' : 'bg-surface-tertiary'
              )}
            >
              <span
                className={cl(
                  'inline-block h-4 w-4 transform rounded-full bg-surface border border-border shadow-sm transition-transform',
                  isAutoStakingEnabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </InfoOverlay>
  )
}
