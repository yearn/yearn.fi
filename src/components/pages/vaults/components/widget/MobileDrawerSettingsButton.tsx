import { Popover, PopoverContent } from '@shared/components/Popover'
import { useYearn } from '@shared/contexts/useYearn'
import { IconSettings } from '@shared/icons/IconSettings'
import { cl } from '@shared/utils'
import { type FC, useCallback, useState } from 'react'

export const MobileDrawerSettingsButton: FC = () => {
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled } = useYearn()
  const [localSlippage, setLocalSlippage] = useState(zapSlippage)

  const handleClose = useCallback(() => {
    if (localSlippage !== zapSlippage) {
      setZapSlippage(localSlippage)
    }
  }, [localSlippage, zapSlippage, setZapSlippage])

  return (
    <Popover
      className="bg-surface-secondary! -mt-2! shadow-none! border-border! w-89!"
      trigger={
        <button
          type="button"
          className={cl(
            'inline-flex size-10 items-center justify-center rounded-full',
            'bg-surface-secondary text-text-secondary',
            'active:scale-95 transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          )}
          aria-label="Open settings"
        >
          <IconSettings className="size-5" />
        </button>
      }
      align="end"
      onClose={handleClose}
    >
      <PopoverContent className="w-full">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium text-text-primary">Transaction Settings</h4>
            <p className="text-xs text-text-secondary">Applies site-wide across all vaults.</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="slippage" className="text-sm text-text-primary">
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
                  type="number"
                  value={localSlippage}
                  onChange={(e) => setLocalSlippage(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 text-xs border border-border text-text-primary bg-surface text-right rounded-md"
                  step="0.1"
                  min="0"
                  max="50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="space-y-0.5">
                <label htmlFor="maximize-yield" className="text-sm text-text-primary">
                  Stake Automatically
                </label>
                <p className="text-xs text-text-secondary">Automatically stake to maximize APY.</p>
                <p className="text-xs text-text-secondary">No assets will be locked.</p>
              </div>
              <button
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
      </PopoverContent>
    </Popover>
  )
}
