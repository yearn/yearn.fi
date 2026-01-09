import { setThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { useNotifications } from '@lib/contexts/useNotifications'
import useWallet from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { IconBurgerPlain } from '@lib/icons/IconBurgerPlain'
import { IconSpinner } from '@lib/icons/IconSpinner'
import { IconWallet } from '@lib/icons/IconWallet'
import { cl } from '@lib/utils'
import { normalizePathname } from '@lib/utils/routes'
import { truncateHex } from '@lib/utils/tools.address'
import { useChainModal } from '@rainbow-me/rainbowkit'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import type { Chain } from 'viem'
import Link from '/src/components/Link'
import { IconMoon } from '../icons/IconMoon'
import { IconSun } from '../icons/IconSun'
import { TypeMarkYearn } from '../icons/TypeMarkYearn'
import { AccountDropdown } from './AccountDropdown'
import { LaunchModal } from './LaunchModal'

export type TMenu = {
  path: string
  label: string | ReactElement
  target?: string
}
type TNavbar = { nav: TMenu[]; currentPathName: string }

function Navbar({ nav, currentPathName }: TNavbar): ReactElement {
  return (
    <nav className={'hidden gap-6'}>
      {nav.map(
        (option): ReactElement => (
          <Link key={option.path} target={option.target} href={option.path}>
            <p
              className={cl(
                'cursor-pointer text-sm font-normal text-text-secondary transition-colors hover:text-text-primary',
                currentPathName.startsWith(option.path) ? 'text-text-primary' : ''
              )}
            >
              {option?.label || 'Unknown'}
            </p>
          </Link>
        )
      )}
    </nav>
  )
}

type TWalletSelectorProps = {
  onAccountClick: () => void
  notificationStatus: 'pending' | 'submitted' | 'success' | 'error' | null
}

function WalletSelector({ onAccountClick, notificationStatus }: TWalletSelectorProps): ReactElement {
  const { openChainModal } = useChainModal()
  const {
    isActive,
    isUserConnecting,
    isIdentityLoading,
    isNetworkMismatch,
    address,
    ens,
    clusters,
    lensProtocolHandle,
    openLoginModal
  } = useWeb3()
  const { isLoading: isWalletLoading } = useWallet()
  const [walletIdentity, setWalletIdentity] = useState<string | undefined>(undefined)

  useEffect((): void => {
    if (isUserConnecting) {
      setWalletIdentity('Connecting...')
    } else if (isNetworkMismatch && address) {
      setWalletIdentity('Invalid Network')
    } else if (ens) {
      setWalletIdentity(ens)
    } else if (clusters) {
      setWalletIdentity(clusters.name)
    } else if (lensProtocolHandle) {
      setWalletIdentity(lensProtocolHandle)
    } else if (address) {
      setWalletIdentity(truncateHex(address, 4))
    } else {
      setWalletIdentity(undefined)
    }
  }, [ens, clusters, lensProtocolHandle, address, isUserConnecting, isNetworkMismatch])

  const shouldShowSpinner = Boolean(
    address &&
      walletIdentity &&
      walletIdentity !== 'Invalid Network' &&
      !isUserConnecting &&
      (isIdentityLoading || isWalletLoading)
  )

  const notificationDotColor = useMemo(() => {
    if (notificationStatus === 'error') return 'bg-red'
    if (notificationStatus === 'success') return 'bg-[#0C9000]'
    if (notificationStatus === 'pending' || notificationStatus === 'submitted') return 'bg-primary animate-pulse'
    return ''
  }, [notificationStatus])

  return (
    <div
      onClick={(): void => {
        if (isActive && !isNetworkMismatch) {
          onAccountClick()
        } else if (isNetworkMismatch && address) {
          openChainModal?.()
        } else {
          openLoginModal()
        }
      }}
      className={'relative cursor-pointer'}
    >
      {walletIdentity && notificationStatus && (
        <div className={cl('absolute -right-0.5 -top-0.5 size-2 rounded-full', notificationDotColor)} />
      )}
      <p
        suppressHydrationWarning
        className={'text-xs font-normal text-text-secondary transition-colors hover:text-text-primary md:text-sm'}
      >
        {walletIdentity ? (
          <span className={'inline-flex items-center gap-2'}>
            <span>{walletIdentity}</span>
            {shouldShowSpinner ? <IconSpinner className={'h-3.5 w-3.5 text-text-tertiary'} /> : null}
          </span>
        ) : (
          <span>
            <IconWallet className={'mt-0.5 block size-4 text-text-secondary md:hidden'} />
            <span
              className={
                'relative hidden h-8 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-text-primary px-2 text-xs font-normal text-surface transition-all hover:opacity-90 md:flex'
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

function AppHeader(_props: { supportedNetworks: Chain[] }): ReactElement {
  const location = useLocation()
  const pathname = location.pathname
  const normalizedPathname = normalizePathname(pathname)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState<boolean>(false)
  const { notificationStatus } = useNotifications()
  const menuRef = useRef<HTMLDivElement>(null)
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const menu = useMemo((): TMenu[] => {
    return [
      { path: 'https://docs.yearn.fi/', label: 'Docs', target: '_blank' },
      { path: 'https://discord.gg/yearn', label: 'Support', target: '_blank' },
      { path: 'https://blog.yearn.fi/', label: 'Blog', target: '_blank' },
      {
        path: 'https://gov.yearn.fi/',
        label: 'Discourse',
        target: '_blank'
      }
    ]
  }, [])

  const isHomePage = normalizedPathname === '/'

  return (
    <>
      <div id={'head'} className={'sticky inset-x-0 top-0 z-50 w-full bg-app backdrop-blur-md'}>
        <div className={'mx-auto w-full max-w-[1232px] px-4'}>
          <header className={'w-full px-0 flex items-center justify-between h-[var(--header-height)]'}>
            <div className={'direction-row flex items-center justify-start gap-x-4 px-1 py-2 md:py-1'}>
              <Link href={'/vaults'} className={'flex items-center justify-center'}>
                <TypeMarkYearn className={'h-8 w-auto'} color={isDarkTheme ? '#FFFFFF' : '#0657F9'} />
              </Link>
              <div className={'hidden md:flex items-center gap-3 pb-0.5'}>
                {/* Vaults section */}
                <Link href={'/vaults'}>
                  <span
                    className={cl(
                      'cursor-pointer text-base font-medium transition-colors relative',
                      pathname.startsWith('/vaults')
                        ? 'text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {'Vaults'}
                  </span>
                </Link>

                {/* Separator */}
                <div className={'h-6 w-px bg-text-primary/20'} />

                {/* Portfolio link */}
                <Link href={'/portfolio'}>
                  <span
                    className={cl(
                      'cursor-pointer text-base font-medium transition-colors relative',
                      pathname.startsWith('/portfolio')
                        ? 'text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {'Portfolio'}
                  </span>
                </Link>

                {/* Separator */}
                <div className={'h-6 w-px bg-text-primary/20'} />

                {/* Ecosystem link */}
                <LaunchModal
                  trigger={({ open }): ReactElement => (
                    <button
                      type={'button'}
                      onClick={open}
                      className={
                        'cursor-pointer text-base font-medium text-text-secondary transition-colors hover:text-text-primary'
                      }
                    >
                      {'Ecosystem'}
                    </button>
                  )}
                />
              </div>
            </div>
            <div className={'flex w-1/2 items-center justify-end'}>
              <Navbar currentPathName={pathname || ''} nav={menu} />
              {!isHomePage && (
                <div className={'direction-row flex items-center justify-end'}>
                  <button
                    className={'rounded-full p-4 text-text-secondary transition-colors hover:text-text-primary'}
                    onClick={(): void => setThemePreference(isDarkTheme ? 'light' : 'soft-dark')}
                    title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {isDarkTheme ? <IconSun className={'size-4'} /> : <IconMoon className={'size-4'} />}
                  </button>
                  <div className={'relative'}>
                    <WalletSelector
                      onAccountClick={(): void => setIsAccountSidebarOpen(true)}
                      notificationStatus={notificationStatus}
                    />
                    <AccountDropdown
                      isOpen={isAccountSidebarOpen}
                      onClose={(): void => setIsAccountSidebarOpen(false)}
                    />
                  </div>
                  <div ref={menuRef} className={'relative flex pl-4 text-text-secondary'}>
                    <button onClick={(): void => setIsMenuOpen(!isMenuOpen)}>
                      <span className={'sr-only'}>{'Open menu'}</span>
                      <IconBurgerPlain />
                    </button>
                    {isMenuOpen && (
                      <div
                        className={
                          'absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-surface p-4 shadow-lg z-50'
                        }
                      >
                        <div className={'flex flex-col gap-1'}>
                          {menu.map((item) => (
                            <Link
                              key={item.path}
                              href={item.path}
                              target={item.target}
                              className={
                                'flex items-center justify-between rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary'
                              }
                              onClick={(): void => setIsMenuOpen(false)}
                            >
                              <span>{item.label}</span>
                              {item.target === '_blank' && <span className={'text-xs'}>{'↗'}</span>}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>
        </div>
      </div>
    </>
  )
}

export default AppHeader
