import { Popover, PopoverContent } from '@lib/components/Popover'
import { IconSettings } from '@lib/icons/IconSettings'
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
      className="bg-surface-secondary! -mt-2! shadow-none! border-border! w-89!"
      trigger={
        <button className="group inline-flex items-center pt-1.5 pr-1.5 pb-0.5 pl-0.5 justify-center rounded-sm transition-colors">
          <IconSettings className="h-4 w-4 text-text-secondary transition-transform duration-300 group-hover:rotate-90" />
        </button>
      }
      align="end"
    >
      <PopoverContent className="w-full">
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
                  maximizeYield ? 'bg-blue-600' : 'bg-surface-secondary'
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
