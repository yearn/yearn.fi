import { setThemePreference, toggleThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { CHART_STYLE_OPTIONS, useChartStyle } from '@lib/contexts/useChartStyle'
import { cl } from '@lib/utils'
import type { TChartStyle } from '@lib/utils/chartStyles'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { useDevFlags } from '/src/contexts/useDevFlags'

export function DevToolbar(): ReactElement | null {
  const [isOpen, setIsOpen] = useState(false)
  const themePreference = useThemePreference()
  const { chartStyle, setChartStyle } = useChartStyle()
  const { headerDisplayMode, setHeaderDisplayMode } = useDevFlags()
  const location = useLocation()
  const enabledInEnv =
    !import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEV_TOOLBAR === 'true' || import.meta.env.MODE !== 'production'

  const isVaultDetail = useMemo(() => /^\/vaults\/\d+\/[^/]+/i.test(location.pathname), [location.pathname])

  const cycleHeaderDisplayMode = () => {
    const modes: Array<'collapsible' | 'full' | 'minimal' | 'sticky-name'> = [
      'collapsible',
      'full',
      'minimal',
      'sticky-name'
    ]
    const currentIndex = modes.indexOf(headerDisplayMode)
    const nextIndex = (currentIndex + 1) % modes.length
    setHeaderDisplayMode(modes[nextIndex])
  }

  useEffect(() => {
    // Ensure themePreference is respected on initial load for the toolbar label
    setThemePreference(themePreference)
  }, [themePreference])

  if (!enabledInEnv) {
    return null
  }

  return (
    <div className={'pointer-events-none fixed right-4 top-4 z-[120] flex flex-col items-end'}>
      <button
        type={'button'}
        onClick={(): void => setIsOpen((previous) => !previous)}
        className={cl(
          'pointer-events-auto inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-neutral-0 px-3 py-2 text-xs font-semibold text-neutral-900 shadow-sm transition hover:border-neutral-400 hover:shadow-md'
        )}
      >
        {'Dev Tools'}
        <span
          className={cl(
            'inline-flex size-4 items-center justify-center rounded-full border text-[10px]',
            isOpen ? 'rotate-90 transition-transform' : 'transition-transform'
          )}
        >
          {'>'}
        </span>
      </button>

      {isOpen ? (
        <div
          className={
            'pointer-events-auto mt-2 w-72 rounded-lg border border-neutral-300 bg-neutral-0 text-neutral-900 shadow-lg'
          }
        >
          <div className={'flex items-center justify-between border-b border-neutral-200 px-3 py-2'}>
            <span className={'text-sm font-semibold'}>{'Developer Toolbar'}</span>
            <button
              type={'button'}
              onClick={(): void => setIsOpen(false)}
              className={
                'flex size-6 items-center justify-center rounded-md text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900'
              }
            >
              {'×'}
            </button>
          </div>
          <div className={'flex flex-col gap-3 p-3 text-sm'}>
            <div className={'flex items-center justify-between'}>
              <span className={'font-medium text-neutral-700'}>{'Theme'}</span>
              <button
                type={'button'}
                onClick={toggleThemePreference}
                className={cl(
                  'inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-semibold transition capitalize',
                  themePreference === 'light'
                    ? 'border-yellow-200 bg-yellow-50 text-yellow-800 hover:border-yellow-300'
                    : themePreference === 'soft-dark'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300'
                      : themePreference === 'blue-dark'
                        ? 'border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300'
                        : 'border-neutral-200 bg-neutral-800 text-neutral-0 hover:border-neutral-300'
                )}
              >
                <span
                  className={cl(
                    'inline-block size-2 rounded-full',
                    themePreference === 'light'
                      ? 'bg-yellow-400'
                      : themePreference === 'soft-dark'
                        ? 'bg-indigo-500'
                        : themePreference === 'blue-dark'
                          ? 'bg-blue-500'
                          : 'bg-neutral-0'
                  )}
                ></span>
                {themePreference}
              </button>
            </div>

            <div className={'flex items-center justify-between'}>
              <span className={'font-medium text-neutral-700'}>{'Chart Style'}</span>
              <select
                className={
                  'h-8 max-w-[10.5rem] rounded-md border border-neutral-200 bg-white px-2 text-xs font-semibold text-neutral-900 shadow-sm transition hover:border-neutral-300 focus:border-neutral-400 focus:outline-none dark:text-neutral-900'
                }
                value={chartStyle}
                onChange={(event) => setChartStyle(event.target.value as TChartStyle)}
              >
                {CHART_STYLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {isVaultDetail ? (
              <div className={'flex items-center justify-between'}>
                <span className={'font-medium text-neutral-700'}>{'Header Display'}</span>
                <button
                  type={'button'}
                  onClick={cycleHeaderDisplayMode}
                  className={cl(
                    'inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-semibold transition capitalize',
                    headerDisplayMode === 'collapsible'
                      ? 'border-green-200 bg-green-50 text-green-800 hover:border-green-300'
                      : headerDisplayMode === 'full'
                        ? 'border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300'
                        : headerDisplayMode === 'minimal'
                          ? 'border-purple-200 bg-purple-50 text-purple-800 hover:border-purple-300'
                          : 'border-orange-200 bg-orange-50 text-orange-800 hover:border-orange-300'
                  )}
                >
                  <span
                    className={cl(
                      'inline-block size-2 rounded-full',
                      headerDisplayMode === 'collapsible'
                        ? 'bg-green-500'
                        : headerDisplayMode === 'full'
                          ? 'bg-blue-500'
                          : headerDisplayMode === 'minimal'
                            ? 'bg-purple-500'
                            : 'bg-orange-500'
                    )}
                  ></span>
                  {headerDisplayMode}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
