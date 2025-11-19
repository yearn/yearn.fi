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
      trigger={
        <button className="inline-flex items-center justify-center hover:bg-gray-100 rounded-full p-1.5 transition-colors">
          <IconSliders className="h-4 w-4 text-blue-600" />
        </button>
      }
      align="end"
    >
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-3 text-black">Transaction Settings</h4>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="slippage" className="text-sm text-black">
                  Slippage Tolerance
                </label>
                <span className="text-sm text-gray-600">{slippage}%</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSlippage(0.1)}
                  className={cl(
                    'px-3 py-1.5 text-xs rounded-md border transition-colors text-black',
                    slippage === 0.1
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  )}
                >
                  0.1%
                </button>
                <button
                  onClick={() => setSlippage(0.5)}
                  className={cl(
                    'px-3 py-1.5 text-xs rounded-md border transition-colors text-black',
                    slippage === 0.5
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  )}
                >
                  0.5%
                </button>
                <button
                  onClick={() => setSlippage(1.0)}
                  className={cl(
                    'px-3 py-1.5 text-xs rounded-md border transition-color text-black',
                    slippage === 1.0
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  )}
                >
                  1.0%
                </button>
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 text-xs border border-gray-200 text-black text-right rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                  step="0.1"
                  min="0"
                  max="50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="space-y-0.5">
                <label htmlFor="maximize-yield" className="text-sm text-black">
                  Maximize Yield
                </label>
                <p className="text-xs text-gray-500">Automatically stake to maximize APY.</p>
                <p className="text-xs text-gray-500">No assets will be locked.</p>
              </div>
              <button
                role="switch"
                aria-checked={maximizeYield}
                onClick={() => setMaximizeYield(!maximizeYield)}
                className={cl(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  maximizeYield ? 'bg-gray-900' : 'bg-gray-200'
                )}
              >
                <span
                  className={cl(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
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
