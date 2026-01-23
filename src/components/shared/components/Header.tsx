import { setThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { useNotifications } from '@shared/contexts/useNotifications'
import useWallet from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconBurgerPlain } from '@shared/icons/IconBurgerPlain'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconMoon } from '@shared/icons/IconMoon'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { IconSun } from '@shared/icons/IconSun'
import { IconWallet } from '@shared/icons/IconWallet'
import { TypeMarkYearn } from '@shared/icons/TypeMarkYearn'
import { cl } from '@shared/utils'
import { normalizePathname } from '@shared/utils/routes'
import { truncateHex } from '@shared/utils/tools.address'
import type { ReactElement } from 'react'
import { useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import Link from '/src/components/Link'
import { AccountDropdown } from './AccountDropdown'
import { LauncherDropdown } from './LauncherDropdown'
import { MobileNavMenu } from './MobileNavMenu'

type TWalletSelectorProps = {
  onAccountClick: () => void
  notificationStatus: 'pending' | 'submitted' | 'success' | 'error' | null
}

function WalletSelector({ onAccountClick, notificationStatus }: TWalletSelectorProps): ReactElement {
  const { isActive, isUserConnecting, isIdentityLoading, address, ens, clusters, openLoginModal } = useWeb3()
  const { isLoading: isWalletLoading } = useWallet()

  const walletIdentity = useMemo((): string | undefined => {
    if (isUserConnecting) return 'Connecting...'
    if (ens) return ens
    if (clusters) return clusters.name
    if (address) return truncateHex(address, 4)
    return undefined
  }, [ens, clusters, address, isUserConnecting])

  const shouldShowSpinner = address && walletIdentity && !isUserConnecting && (isIdentityLoading || isWalletLoading)

  const notificationDotColor = useMemo((): string => {
    switch (notificationStatus) {
      case 'error':
        return 'bg-red'
      case 'success':
        return 'bg-[#0C9000]'
      case 'pending':
      case 'submitted':
        return 'bg-primary animate-pulse'
      default:
        return ''
    }
  }, [notificationStatus])

  function handleClick(): void {
    if (isActive) {
      onAccountClick()
      return
    }
    openLoginModal()
  }

  return (
    <div onMouseDown={(e) => e.stopPropagation()} onClick={handleClick} className={'relative cursor-pointer'}>
      {walletIdentity && notificationStatus && (
        <div className={cl('absolute -right-0.5 -top-0.5 size-2 rounded-full', notificationDotColor)} />
      )}
      <p
        suppressHydrationWarning
        className={'text-xs font-normal text-text-secondary transition-colors hover:text-text-primary md:text-sm'}
      >
        {walletIdentity ? (
          <span className={'inline-flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-1.5'}>
            <span>{walletIdentity}</span>
            {shouldShowSpinner && <IconSpinner className={'size-3.5 text-text-tertiary'} />}
          </span>
        ) : (
          <span>
            <IconWallet className={'mt-0.5 block size-4 text-text-secondary md:hidden'} />
            <span
              className={
                'relative hidden h-8 cursor-pointer items-center justify-center rounded-xl border border-transparent bg-text-primary px-3 text-xs font-normal text-surface transition-all hover:opacity-90 md:flex'
              }
            >
              {'Connect wallet'}
            </span>
          </span>
        )}
      </p>
    </div>
  )
}

function AppHeader(): ReactElement {
  const location = useLocation()
  const pathname = location.pathname
  const [isLauncherOpen, setIsLauncherOpen] = useState(false)
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const launcherTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { notificationStatus } = useNotifications()
  const { isActive, openLoginModal, address, ens, clusters } = useWeb3()
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'

  const isHomePage = normalizePathname(pathname) === '/'

  const walletIdentity = useMemo((): string | undefined => {
    if (ens) return ens
    if (clusters?.name) return clusters.name
    if (address) return truncateHex(address, 4)
    return undefined
  }, [ens, clusters, address])

  const handleLauncherMouseEnter = (): void => {
    if (launcherTimeoutRef.current) {
      clearTimeout(launcherTimeoutRef.current)
      launcherTimeoutRef.current = null
    }
    setIsLauncherOpen(true)
  }

  const handleLauncherMouseLeave = (): void => {
    launcherTimeoutRef.current = setTimeout(() => {
      setIsLauncherOpen(false)
    }, 150)
  }

  function navLinkClass(isActive: boolean): string {
    const baseClass = 'cursor-pointer text-base font-medium transition-colors relative'
    if (isHomePage) {
      return cl(baseClass, isActive ? 'text-white' : 'text-neutral-400 hover:text-white')
    }
    return cl(baseClass, isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary')
  }

  return (
    <div
      id={'head'}
      className={cl('sticky inset-x-0 top-0 z-50 w-full backdrop-blur-md', isHomePage ? 'bg-transparent' : 'bg-app')}
    >
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header className={'flex h-[var(--header-height)] w-full items-center justify-between px-0'}>
          <div className={'flex items-center justify-start gap-x-4 px-1 py-2 md:py-1'}>
            <div className={'relative'} onMouseEnter={handleLauncherMouseEnter} onMouseLeave={handleLauncherMouseLeave}>
              <button
                type={'button'}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setIsLauncherOpen(!isLauncherOpen)}
                className={'flex items-center gap-1 transition-colors hover:opacity-80'}
              >
                <TypeMarkYearn className={'h-8 w-auto'} color={isHomePage || isDarkTheme ? '#FFFFFF' : '#0657F9'} />
                <IconChevron
                  className={cl(
                    'size-4 transition-transform',
                    isHomePage ? 'text-neutral-400' : 'text-text-secondary',
                    isLauncherOpen ? 'rotate-180' : ''
                  )}
                />
              </button>
              <LauncherDropdown
                isOpen={isLauncherOpen}
                onClose={() => setIsLauncherOpen(false)}
                forceDark={isHomePage || undefined}
              />
            </div>
            <div className={'hidden items-center gap-3 pb-0.5 md:flex'}>
              <Link href={'/vaults'}>
                <span className={navLinkClass(pathname.startsWith('/vaults'))}>{'Vaults'}</span>
              </Link>

              <div className={cl('h-6 w-px', isHomePage ? 'bg-white/20' : 'bg-text-primary/20')} />

              <Link href={'/portfolio'}>
                <span className={navLinkClass(pathname.startsWith('/portfolio'))}>{'Portfolio'}</span>
              </Link>
            </div>
          </div>
          <div className={'flex items-center justify-end gap-2'}>
            {!isHomePage && (
              <>
                <div className={'hidden items-center justify-end md:flex'}>
                  <button
                    className={
                      'min-h-[44px] min-w-[44px] rounded-full p-2.5 text-text-secondary transition-colors hover:text-text-primary'
                    }
                    onClick={() => setThemePreference(isDarkTheme ? 'light' : 'soft-dark')}
                    title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {isDarkTheme ? <IconSun className={'size-5'} /> : <IconMoon className={'size-5'} />}
                  </button>
                  <WalletSelector
                    onAccountClick={() => setIsAccountSidebarOpen(!isAccountSidebarOpen)}
                    notificationStatus={notificationStatus}
                  />
                </div>
                <button
                  className={cl(
                    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2.5 transition-colors md:hidden',
                    isHomePage ? 'text-white hover:bg-white/10' : 'text-text-primary hover:bg-surface-secondary'
                  )}
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label={'Open navigation menu'}
                >
                  <IconBurgerPlain className={'size-6'} />
                </button>
                <AccountDropdown isOpen={isAccountSidebarOpen} onClose={() => setIsAccountSidebarOpen(false)} />
              </>
            )}
          </div>
        </header>
      </div>
      <MobileNavMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        pathname={pathname}
        isDarkTheme={isDarkTheme}
        onThemeToggle={() => setThemePreference(isDarkTheme ? 'light' : 'soft-dark')}
        onAccountClick={() => {
          setIsMobileMenuOpen(false)
          if (isActive) {
            setIsAccountSidebarOpen(true)
          } else {
            openLoginModal()
          }
        }}
        notificationStatus={notificationStatus}
        walletIdentity={walletIdentity}
      />
    </div>
  )
}

export default AppHeader
