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
import { useLocation } from 'react-router'
import type { Chain } from 'viem'
import Link from '/src/components/Link'
import { TypeMarkYearn } from '../../../apps/lib/icons/TypeMarkYearn-text-only'
import { LaunchModal } from './LaunchModal'
import { ModalMobileMenu } from './ModalMobileMenu'

export type TMenu = {
  path: string
  label: string | ReactElement
  target?: string
}
type TNavbar = { nav: TMenu[]; currentPathName: string }

const PRIMARY_LINKS = [
  { path: '/v3', label: 'Vaults' },
  { path: '/portfolio', label: 'Portfolio' }
]

function Navbar({ nav, currentPathName }: TNavbar): ReactElement {
  return (
    <nav className={'yearn--nav'}>
      {nav.map(
        (option, index): ReactElement => (
          <Link key={option.path} target={option.target} href={option.path}>
            <p
              className={`yearn--header-nav-item ${
                currentPathName.startsWith(option.path) ? 'active' : ''
              } ${index > 0 ? 'hidden md:block' : ''}`}
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
    >
      <p suppressHydrationWarning className={'yearn--header-nav-item text-xs! md:text-sm!'}>
        {walletIdentity ? (
          <span className={'inline-flex items-center gap-2'}>
            <span>{walletIdentity}</span>
            {shouldShowSpinner ? (
              <IconSpinner className={'h-3.5 w-3.5 text-neutral-100 dark:text-neutral-700'} />
            ) : null}
          </span>
        ) : (
          <span>
            <IconWallet className={'yearn--header-nav-item mt-0.5 block size-4 md:hidden'} />
            <span
              className={
                'text-neutral-0 relative hidden h-8 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-neutral-900 px-2 text-xs font-normal transition-all hover:bg-neutral-800 md:flex'
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

    // if (pathname.startsWith('/vaults-beta')) {
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

  return (
    <div id={'head'} className={'inset-x-0 top-0 z-50 w-full'}>
      <div className={'w-full'}>
        <header className={'yearn--header mx-auto max-w-[1232px] px-0!'}>
          <div className={'direction-row flex items-center justify-start gap-x-2 px-1 py-2 md:py-1'}>
            <div className={'flex justify-center'}>
              <LaunchModal />
            </div>
            <div className={'flex items-center gap-2 md:gap-4'}>
              <TypeMarkYearn className={'h-8 w-auto pt-1'} color={'white'} />
              <div className={'flex items-center gap-4'}>
                {PRIMARY_LINKS.map((link) => (
                  <Link key={link.path} href={link.path}>
                    <span
                      className={cl('yearn--header-nav-item text-lg!', pathname.startsWith(link.path) ? 'active' : '')}
                    >
                      {link.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className={'flex w-1/2 items-center justify-end'}>
            <Navbar currentPathName={pathname || ''} nav={menu} />
            <button
              className={'yearn--header-nav-item relative rounded-full p-4 transition-colors'}
              onClick={(): void => setShouldOpenCurtain(true)}
            >
              <IconBell className={'size-4 font-bold transition-colors'} />

              <div className={cl('absolute right-4 top-4 size-2 rounded-full', notificationDotColor)} />
            </button>
            <WalletSelector />
            <div className={'flex md:hidden pl-4 text-neutral-500'}>
              <button onClick={(): void => setIsMenuOpen(!isMenuOpen)}>
                <span className={'sr-only'}>{'Open menu'}</span>
                <IconBurgerPlain />
              </button>
            </div>
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
        {menu?.map(
          (option): ReactElement => (
            <Link key={option.path} href={option.path}>
              <div className={'mobile-nav-item'} onClick={(): void => setIsMenuOpen(false)}>
                <p className={'font-bold'}>{option.label}</p>
              </div>
            </Link>
          )
        )}
      </ModalMobileMenu>
    </div>
  )
}

export default AppHeader
