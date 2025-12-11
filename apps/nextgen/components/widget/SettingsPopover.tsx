import { Popover, PopoverContent } from '@lib/components/Popover'
import { IconSliders } from '@lib/icons/IconSliders'
import { cl } from '@lib/utils'
import type { FC } from 'react'

interface SettingsPopoverProps {
  slippage: number
  setSlippage: (value: number) => void
  maximizeYield: boolean
  setMaximizeYield: (value: boolean) => void
}

export const SettingsPopover: FC<SettingsPopoverProps> = ({
  slippage,
  setSlippage,
  maximizeYield,
  setMaximizeYield
}) => {
  return (
    <Popover
      className="!border-border"
      trigger={
        <button className="inline-flex items-center justify-center hover:bg-surface-secondary rounded-sm p-1.5 transition-colors">
          <IconSliders className="h-3 w-3 text-blue-600" />
        </button>
      }
      align="end"
    >
      <PopoverContent className="w-80 bg-surface-secondary">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-3 text-text-primary">Transaction Settings</h4>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="slippage" className="text-sm text-text-primary">
                  Slippage Tolerance
                </label>
                <span className="text-sm text-text-secondary">{slippage}%</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSlippage(0.1)}
                  className={cl(
                    'px-3 py-1.5 text-xs rounded-md border transition-colors',
                    slippage === 0.1
                      ? 'bg-surface-tertiary text-text-primary border-surface-tertiary font-semibold'
                      : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                  )}
                >
                  0.1%
                </button>
                <button
                  onClick={() => setSlippage(0.5)}
                  className={cl(
                    'px-3 py-1.5 text-xs rounded-md border transition-colors',
                    slippage === 0.5
                      ? 'bg-surface-tertiary text-text-primary border-surface-tertiary font-semibold'
                      : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                  )}
                >
                  0.5%
                </button>
                <button
                  onClick={() => setSlippage(1.0)}
                  className={cl(
                    'px-3 py-1.5 text-xs rounded-md border transition-colors',
                    slippage === 1.0
                      ? 'bg-surface-tertiary text-text-primary border-surface-tertiary font-semibold'
                      : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                  )}
                >
                  1.0%
                </button>
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 text-xs border border-border text-text-primary bg-surface text-right rounded-md focus:outline-none focus:ring-2 focus:ring-border-focus"
                  step="0.1"
                  min="0"
                  max="50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="space-y-0.5">
                <label htmlFor="maximize-yield" className="text-sm text-text-primary">
                  Maximize Yield
                </label>
                <p className="text-xs text-text-secondary">Automatically stake to maximize APY.</p>
                <p className="text-xs text-text-secondary">No assets will be locked.</p>
              </div>
              <button
                role="switch"
                aria-checked={maximizeYield}
                onClick={() => setMaximizeYield(!maximizeYield)}
                className={cl(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  maximizeYield ? 'bg-surface-tertiary' : 'bg-surface-secondary'
                )}
              >
                <span
                  className={cl(
                    'inline-block h-4 w-4 transform rounded-full bg-surface border border-border shadow-sm transition-transform',
                    maximizeYield ? 'translate-x-6' : 'translate-x-1'
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
