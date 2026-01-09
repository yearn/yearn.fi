import { useNotifications } from '@lib/contexts/useNotifications'
import useWallet from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { IconBell } from '@lib/icons/IconBell'
import { IconBurgerPlain } from '@lib/icons/IconBurgerPlain'
import { IconSpinner } from '@lib/icons/IconSpinner'
import { IconWallet } from '@lib/icons/IconWallet'
import { cl } from '@lib/utils'
import { normalizePathname } from '@lib/utils/routes'
import { truncateHex } from '@lib/utils/tools.address'
import { useAccountModal, useChainModal } from '@rainbow-me/rainbowkit'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import type { Chain } from 'viem'
import Link from '/src/components/Link'
import { TypeMarkYearn as TypeMarkYearnText } from '../icons/TypeMarkYearn-text-only'
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

function WalletSelector(): ReactElement {
  const { openAccountModal } = useAccountModal()
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

  return (
    <div
      onClick={(): void => {
        if (isActive && !isNetworkMismatch) {
          openAccountModal?.()
        } else if (isNetworkMismatch && address) {
          openChainModal?.()
        } else {
          openLoginModal()
        }
      }}
      className={'cursor-pointer'}
    >
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
  const { setShouldOpenCurtain, notificationStatus } = useNotifications()
  const menuRef = useRef<HTMLDivElement>(null)

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
    // const HOME_MENU = { path: '/apps', label: 'Apps' }

    // if (pathname.startsWith('/ycrv')) {
    //   return [...APPS[AppName.YCRV].menu]
    // }

    // if (pathname.startsWith('/v3')) {
    //   return [...APPS[AppName.VAULTSV3].menu]
    // }

    // if (pathname.startsWith('/vaults')) {
    //   return [...APPS[AppName.BETA].menu]
    // }

    // if (pathname.startsWith('/vaults')) {
    //   return [...APPS[AppName.VAULTS].menu]
    // }

    // if (pathname.startsWith('/veyfi')) {
    //   return [...APPS[AppName.VEYFI].menu]
    // }

    return [
      // HOME_MENU,
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

  const notificationDotColor = useMemo(() => {
    if (notificationStatus === 'error') {
      return 'bg-red'
    }

    if (notificationStatus === 'success') {
      return 'bg-[#0C9000]'
    }
    if (notificationStatus === 'pending') {
      return 'bg-primary animate-pulse'
    }

    return ''
  }, [notificationStatus])

  const isHomePage = normalizedPathname === '/'

  return (
    <div id={'head'} className={'sticky inset-x-0 top-0 z-50 w-full bg-app backdrop-blur-md'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header className={'w-full px-0 flex items-center justify-between h-[var(--header-height)]'}>
          <div className={'direction-row flex items-center justify-start gap-x-2 px-1 py-2 md:py-1'}>
            <div className={'flex justify-center'}>
              <LaunchModal />
            </div>
            <div className={'flex items-center gap-2 md:gap-4'}>
              <TypeMarkYearnText className={'yearn-typemark h-7 w-auto text-text-primary mr-2 mt-[3px]'} />
              {/* <TypeMarkYearnFull className={'yearn-typemark hidden h-8 w-auto md:block'} color={'currentColor'} /> */}
              <div className={'hidden md:flex items-center gap-3 pb-0.5'}>
                {/* Vaults section with version switch */}
                <div className={'flex items-center gap-2'}>
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
                </div>

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
              </div>
            </div>
          </div>
          <div className={'flex w-1/2 items-center justify-end'}>
            <Navbar currentPathName={pathname || ''} nav={menu} />
            {!isHomePage && (
              <div className={'direction-row flex items-center justify-end'}>
                <button
                  className={'relative rounded-full p-4 text-text-secondary transition-colors hover:text-text-primary'}
                  onClick={(): void => setShouldOpenCurtain(true)}
                >
                  <IconBell className={'size-4 font-bold transition-colors'} />

                  <div className={cl('absolute right-4 top-4 size-2 rounded-full', notificationDotColor)} />
                </button>
                <WalletSelector />
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
                      <div className={'flex flex-col gap-2'}>
                        <Link
                          href={'/vaults'}
                          className={cl(
                            'block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-secondary',
                            pathname.startsWith('/vaults') &&
                              !location.search.includes('type=lp') &&
                              !location.search.includes('type=factory')
                              ? 'text-text-primary bg-surface-secondary'
                              : 'text-text-secondary hover:text-text-primary'
                          )}
                          onClick={(): void => setIsMenuOpen(false)}
                        >
                          {'Vaults'}
                        </Link>
                        <Link
                          href={'/portfolio'}
                          className={cl(
                            'block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-secondary',
                            pathname.startsWith('/portfolio')
                              ? 'text-text-primary bg-surface-secondary'
                              : 'text-text-secondary hover:text-text-primary'
                          )}
                          onClick={(): void => setIsMenuOpen(false)}
                        >
                          {'Portfolio'}
                        </Link>
                      </div>
                      <div className={'my-3 h-px bg-border'} />
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
  )
}

export default AppHeader
