import { setThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { useNotifications } from '@shared/contexts/useNotifications'
import useWallet from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconBurgerPlain } from '@shared/icons/IconBurgerPlain'
import { IconMoon } from '@shared/icons/IconMoon'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { IconSun } from '@shared/icons/IconSun'
import { IconWallet } from '@shared/icons/IconWallet'
import { TypeMarkYearn } from '@shared/icons/TypeMarkYearn'
import { cl } from '@shared/utils'
import { normalizePathname } from '@shared/utils/routes'
import { truncateHex } from '@shared/utils/tools.address'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import Link from '/src/components/Link'
import { AccountDropdown } from './AccountDropdown'
import { HeaderNavMenu } from './HeaderNavMenu'
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
    if (shouldShowSpinner || isUserConnecting) return
    if (isActive || address || ens || clusters) {
      onAccountClick()
      return
    }
    openLoginModal()
  }

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleClick}
      className={cl('relative', shouldShowSpinner ? 'cursor-wait' : 'cursor-pointer')}
    >
      {walletIdentity && notificationStatus && (
        <div className={cl('absolute -right-0.5 -top-0.5 size-2 rounded-full', notificationDotColor)} />
      )}
      <p
        suppressHydrationWarning
        className={'text-xs font-normal text-text-secondary transition-colors hover:text-text-primary md:text-sm'}
      >
        {walletIdentity ? (
          <span className={'inline-flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-1.5'}>
            <IconWallet className={'size-4 text-text-secondary'} />
            <span>{walletIdentity}</span>
            {shouldShowSpinner && <IconSpinner className={'size-3.5 text-text-tertiary'} />}
          </span>
        ) : (
          <span>
            <IconWallet className={'mt-0.5 block size-4 text-text-secondary md:hidden'} />
            <span
              className={
                'relative hidden h-8 cursor-pointer items-center gap-2 justify-center rounded-lg border border-transparent bg-text-primary px-3 text-xs font-normal text-surface transition-all hover:opacity-90 md:flex'
              }
            >
              <IconWallet className={'size-4 text-surface'} />
              <span>{'Connect wallet'}</span>
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
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { notificationStatus } = useNotifications()
  const { address, ens, clusters } = useWeb3()
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'

  const isHomePage = normalizePathname(pathname) === '/'

  const walletIdentity = useMemo((): string | undefined => {
    if (ens) return ens
    if (clusters?.name) return clusters.name
    if (address) return truncateHex(address, 4)
    return undefined
  }, [ens, clusters, address])

  return (
    <div
      id={'head'}
      className={cl('sticky inset-x-0 top-0 z-50 w-full backdrop-blur-md', isHomePage ? 'bg-transparent' : 'bg-app')}
    >
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header className={'flex h-[var(--header-height)] w-full items-center justify-between px-0'}>
          <div className={'flex items-center justify-start gap-x-6 px-1 py-2 md:py-1'} data-tour="vaults-header-nav">
            <Link href={'/'} className={'flex items-center gap-1 transition-colors hover:opacity-80'}>
              <TypeMarkYearn className={'h-8 w-auto'} color={isHomePage || isDarkTheme ? '#FFFFFF' : '#0657F9'} />
            </Link>
            <div className={'hidden items-center gap-3 pb-0.5 md:flex'}>
              <HeaderNavMenu isHomePage={isHomePage} isDarkTheme={isDarkTheme} />
            </div>
          </div>
          <div className={'flex items-center justify-end gap-2'}>
            {!isHomePage && (
              <>
                <div className={'hidden items-center justify-end md:flex gap-2'} data-tour="vaults-header-user">
                  <Link href={'/portfolio'}>
                    <span
                      className={'text-base font-medium text-text-secondary transition-colors hover:text-text-primary'}
                    >
                      {'Portfolio'}
                    </span>
                  </Link>

                  <button
                    className={
                      'min-h-[44px] min-w-[44px] rounded-full p-2.5 text-text-secondary transition-colors hover:text-text-primary'
                    }
                    onClick={() => setThemePreference(isDarkTheme ? 'light' : 'soft-dark')}
                    title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {isDarkTheme ? <IconSun className={'size-5'} /> : <IconMoon className={'size-5'} />}
                  </button>
                  <div className={'relative'}>
                    <WalletSelector
                      onAccountClick={() => setIsAccountSidebarOpen(!isAccountSidebarOpen)}
                      notificationStatus={notificationStatus}
                    />
                    <AccountDropdown isOpen={isAccountSidebarOpen} onClose={() => setIsAccountSidebarOpen(false)} />
                  </div>
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
        notificationStatus={notificationStatus}
        walletIdentity={walletIdentity}
      />
    </div>
  )
}

export default AppHeader
