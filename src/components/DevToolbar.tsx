import { setThemePreference, toggleThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { useDevFlags } from '/src/contexts/useDevFlags'

export function DevToolbar(): ReactElement | null {
  const [isOpen, setIsOpen] = useState(false)
  const themePreference = useThemePreference()
  const { headerDisplayMode, setHeaderDisplayMode } = useDevFlags()
  const location = useLocation()
  const enabledInEnv =
    !import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEV_TOOLBAR === 'true' || import.meta.env.MODE !== 'production'

  const isVaultDetail = useMemo(() => /^\/vaults-beta\/\d+\/[^/]+/i.test(location.pathname), [location.pathname])

  const cycleHeaderDisplayMode = () => {
    const modes: Array<'collapsible' | 'full' | 'minimal'> = ['collapsible', 'full', 'minimal']
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
                className={
                  'inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50'
                }
              >
                <span className={'inline-block h-2 w-2 rounded-full bg-neutral-800'}></span>
                {themePreference === 'dark' ? 'Dark' : 'Light'}
              </button>
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
                        : 'border-purple-200 bg-purple-50 text-purple-800 hover:border-purple-300'
                  )}
                >
                  <span
                    className={cl(
                      'inline-block size-2 rounded-full',
                      headerDisplayMode === 'collapsible'
                        ? 'bg-green-500'
                        : headerDisplayMode === 'full'
                          ? 'bg-blue-500'
                          : 'bg-purple-500'
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
