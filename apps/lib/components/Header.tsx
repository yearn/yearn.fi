import { useNotifications } from '@lib/contexts/useNotifications'
import useWallet from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { IconBell } from '@lib/icons/IconBell'
import { IconBurgerPlain } from '@lib/icons/IconBurgerPlain'
import { IconSpinner } from '@lib/icons/IconSpinner'
import { IconWallet } from '@lib/icons/IconWallet'
import { cl } from '@lib/utils'
import { truncateHex } from '@lib/utils/tools.address'
import { useAccountModal, useChainModal } from '@rainbow-me/rainbowkit'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { Chain } from 'viem'
import Link from '/src/components/Link'
import { TypeMarkYearn as TypeMarkYearnText } from '../icons/TypeMarkYearn-text-only'
import { LaunchModal } from './LaunchModal'
import { ModalMobileMenu } from './ModalMobileMenu'

export type TMenu = {
  path: string
  label: string | ReactElement
  target?: string
}
type TNavbar = { nav: TMenu[]; currentPathName: string }

function Navbar({ nav, currentPathName }: TNavbar): ReactElement {
  return (
    <nav className={'hidden md:flex gap-6'}>
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

function VaultVersionSwitch(): ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const searchParams = new URLSearchParams(location.search)
  const typeParam = searchParams.get('type')

  const isOnVaultsPage = pathname.startsWith('/vaults')
  const isV2Active = isOnVaultsPage && typeParam === 'v2'
  const isV3Active = isOnVaultsPage && typeParam !== 'v2'

  return (
    <div
      className={
        'flex shrink-0 items-center gap-px rounded-full border h-7 py-0.5 px-0.5 bg-surface-secondary border-border text-xs'
      }
    >
      <button
        type={'button'}
        className={cl(
          'flex items-center rounded-full px-2.5 py-0.5 font-medium transition-all',
          'hover:bg-surface/70',
          'data-[active=false]:text-text-secondary data-[active=false]:opacity-60 data-[active=false]:hover:text-text-primary data-[active=false]:hover:opacity-100',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary data-[active=true]:opacity-100 data-[active=true]:shadow-sm'
        )}
        data-active={isV3Active}
        onClick={(): void => void navigate('/vaults')}
        aria-pressed={isV3Active}
      >
        {'V3'}
      </button>
      <button
        type={'button'}
        className={cl(
          'flex items-center rounded-full px-2.5 py-0.5 font-medium transition-all',
          'hover:bg-surface/70',
          'data-[active=false]:text-text-secondary data-[active=false]:opacity-60 data-[active=false]:hover:text-text-primary data-[active=false]:hover:opacity-100',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary data-[active=true]:opacity-100 data-[active=true]:shadow-sm'
        )}
        data-active={isV2Active}
        onClick={(): void => void navigate('/vaults?type=v2')}
        aria-pressed={isV2Active}
      >
        {'V2'}
      </button>
    </div>
  )
}

function AppHeader(props: { supportedNetworks: Chain[] }): ReactElement {
  const location = useLocation()
  const pathname = location.pathname
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const { setShouldOpenCurtain, notificationStatus } = useNotifications()

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

  const isHomePage = window.location.pathname === '/'

  return (
    <div id={'head'} className={'sticky inset-x-0 top-0 z-50 w-full bg-app backdrop-blur-md'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header className={'w-full px-0 flex items-center justify-between h-[var(--header-height)]'}>
          <div className={'direction-row flex items-center justify-start gap-x-2 px-1 py-2 md:py-1'}>
            <div className={'flex justify-center'}>
              <LaunchModal />
            </div>
            <div className={'flex items-center gap-2 md:gap-4'}>
              <TypeMarkYearnText className={'yearn-typemark h-8 w-auto text-text-primary'} />
              {/* <TypeMarkYearnFull className={'yearn-typemark hidden h-8 w-auto md:block'} color={'currentColor'} /> */}
              <div className={'hidden md:flex items-center gap-3 pb-0.5'}>
                {/* Vaults section with version switch */}
                <div className={'flex items-center gap-2'}>
                  <Link href={'/vaults'}>
                    <span
                      className={cl(
                        'cursor-pointer text-lg font-medium transition-colors relative',
                        pathname.startsWith('/vaults')
                          ? 'text-text-primary'
                          : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {'Vaults'}
                    </span>
                  </Link>
                  <VaultVersionSwitch />
                </div>

                {/* Separator */}
                <div className={'h-6 w-px bg-text-primary/20'} />

                {/* Portfolio link */}
                <Link href={'/portfolio'}>
                  <span
                    className={cl(
                      'cursor-pointer text-lg font-medium transition-colors relative',
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
                <div className={'flex md:hidden pl-4 text-text-secondary'}>
                  <button onClick={(): void => setIsMenuOpen(!isMenuOpen)}>
                    <span className={'sr-only'}>{'Open menu'}</span>
                    <IconBurgerPlain />
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
      </div>
      <ModalMobileMenu
        shouldUseWallets={true}
        shouldUseNetworks={true}
        isOpen={isMenuOpen}
        onClose={(): void => setIsMenuOpen(false)}
        supportedNetworks={props.supportedNetworks}
      >
        <Link
          href={'/vaults'}
          className={'flex items-center gap-2 text-white transition-colors hover:text-primary'}
          onClick={(): void => setIsMenuOpen(false)}
        >
          <span className={'text-[32px] font-bold'}>{'V3 Vaults'}</span>
        </Link>
        <Link
          href={'/vaults?type=v2'}
          className={'flex items-center gap-2 text-white transition-colors hover:text-primary'}
          onClick={(): void => setIsMenuOpen(false)}
        >
          <span className={'text-[32px] font-bold'}>{'V2 Vaults'}</span>
        </Link>
        <Link
          href={'/portfolio'}
          className={'flex items-center gap-2 text-white transition-colors hover:text-primary'}
          onClick={(): void => setIsMenuOpen(false)}
        >
          <span className={'text-[32px] font-bold'}>{'Portfolio'}</span>
        </Link>
      </ModalMobileMenu>
    </div>
  )
}

export default AppHeader
