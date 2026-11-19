import { setThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { BottomDrawer } from '@pages/vaults/components/detail/BottomDrawer'
import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
import { AccountDropdown } from '@shared/components/AccountDropdown'
import { MobileSiteStatus } from '@shared/components/SiteStatus'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconMoon } from '@shared/icons/IconMoon'
import { IconSun } from '@shared/icons/IconSun'
import { cl } from '@shared/utils'
import { MobileNavMenu as SharedMobileNavMenu, type TMobileNavMenuProps } from '@yearn/site-header/mobile'
import { useWalletDrawer } from '@yearn/wallet-ui'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { env } from '@/env'

type TYearnMobileNavMenuProps = Pick<
  TMobileNavMenuProps,
  'isOpen' | 'onClose' | 'pathname' | 'isDarkTheme' | 'onThemeToggle' | 'notificationStatus' | 'walletIdentity'
>

export function MobileNavMenu({
  isOpen,
  onClose,
  pathname,
  isDarkTheme,
  onThemeToggle,
  notificationStatus,
  walletIdentity
}: TYearnMobileNavMenuProps): ReactElement {
  const [isWalletDrawerOpen, setIsWalletDrawerOpen] = useState(false)
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const { isActive, openLoginModal } = useWeb3()
  const { acknowledge } = useNotifications()
  const { isOpen: isWalletPickerOpen } = useWalletDrawer()
  const { shouldHideDust, onSwitchHideDust } = useAppSettings()
  const themePreference = useThemePreference()

  const handleWalletClick = (): void => {
    acknowledge()
    onClose()
    if (isActive) {
      setIsWalletDrawerOpen(true)
    } else {
      openLoginModal()
    }
  }

  const handleSettingsClick = (): void => {
    onClose()
    setIsSettingsDrawerOpen(true)
  }

  function getVariantButtonClass(variant: string): string {
    if (themePreference === variant) {
      return 'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors bg-primary/10 text-primary'
    }
    return cl(
      'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isDarkTheme
        ? 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
    )
  }

  return (
    <>
      <SharedMobileNavMenu
        isOpen={isOpen && !isWalletDrawerOpen && !isWalletPickerOpen && !isSettingsDrawerOpen}
        onClose={onClose}
        pathname={pathname}
        isDarkTheme={isDarkTheme}
        onThemeToggle={onThemeToggle}
        notificationStatus={notificationStatus}
        walletIdentity={walletIdentity}
        onWalletClick={handleWalletClick}
        onSettingsClick={handleSettingsClick}
        assetBaseUrl={env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}
        footer={<MobileSiteStatus onNavigate={onClose} />}
      />
      <AccountDropdown isOpen={isWalletDrawerOpen} onClose={() => setIsWalletDrawerOpen(false)} />
      <BottomDrawer
        isOpen={isSettingsDrawerOpen}
        onClose={() => {
          setIsSettingsDrawerOpen(false)
          setIsAdvancedOpen(false)
        }}
        title={'Settings'}
      >
        <div className={'px-4 py-4'}>
          <div className={'mb-4 flex items-center justify-between'}>
            <span className={'text-sm font-medium text-text-primary'}>{'Theme'}</span>
            <div className={cl('flex rounded-full p-0.5', isDarkTheme ? 'bg-surface-secondary' : 'bg-neutral-100')}>
              <button
                onClick={() => setThemePreference('light')}
                className={cl(
                  'flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  !isDarkTheme
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <IconSun className={'size-4'} />
              </button>
              <button
                onClick={() => setThemePreference(themePreference === 'light' ? 'soft-dark' : themePreference)}
                className={cl(
                  'flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  isDarkTheme ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <IconMoon className={'size-4'} />
              </button>
            </div>
          </div>

          {isDarkTheme && (
            <div className={'mb-4'}>
              <span className={'mb-2 block text-xs font-medium text-text-secondary'}>{'Dark variant'}</span>
              <div className={'flex flex-col gap-1'}>
                {(['soft-dark', 'blue-dark', 'midnight'] as const).map((variant) => (
                  <button
                    key={variant}
                    onClick={() => setThemePreference(variant)}
                    className={getVariantButtonClass(variant)}
                  >
                    <span>
                      {
                        {
                          'soft-dark': 'Soft Dark',
                          'blue-dark': 'Blue Dark',
                          midnight: 'Midnight'
                        }[variant]
                      }
                    </span>
                    {themePreference === variant && <IconChevron className={'size-4 -rotate-90'} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className={getVariantButtonClass('advanced')}
            onClick={() => setIsAdvancedOpen((previous) => !previous)}
            aria-expanded={isAdvancedOpen}
            aria-controls={'mobile-nav-settings-advanced'}
          >
            <span>{'Advanced'}</span>
            <IconChevron className={cl('size-4 transition-transform', isAdvancedOpen ? 'rotate-0' : '-rotate-90')} />
          </button>
          {isAdvancedOpen && (
            <div
              id={'mobile-nav-settings-advanced'}
              className={cl(
                'mt-2 rounded-lg border p-2',
                isDarkTheme ? 'border-border bg-surface-secondary' : 'border-neutral-200 bg-neutral-50'
              )}
            >
              <div className={'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium'}>
                <span className={'text-text-primary'}>{'Show dust'}</span>
                <button
                  type={'button'}
                  role={'switch'}
                  aria-checked={!shouldHideDust}
                  aria-label={!shouldHideDust ? 'Hide dust positions' : 'Show dust positions'}
                  onClick={onSwitchHideDust}
                  className={cl(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
                    !shouldHideDust ? 'border-primary bg-primary/20' : 'border-border bg-surface'
                  )}
                >
                  <span
                    className={cl(
                      'block size-3 rounded-full transition-transform',
                      !shouldHideDust ? 'translate-x-[18px] bg-primary' : 'translate-x-[3px] bg-text-secondary'
                    )}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </BottomDrawer>
    </>
  )
}
