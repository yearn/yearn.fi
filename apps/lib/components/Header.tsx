import { useNotifications } from '@lib/contexts/useNotifications'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { IconBell } from '@lib/icons/IconBell'
import { IconBurgerPlain } from '@lib/icons/IconBurgerPlain'
import { IconWallet } from '@lib/icons/IconWallet'
import { cl } from '@lib/utils'
import { truncateHex } from '@lib/utils/tools.address'
import { useAccountModal, useChainModal } from '@rainbow-me/rainbowkit'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import type { Chain } from 'viem'
import Link from '/src/components/Link'
import { APPS, AppName } from './Apps'
import { LogoPopover } from './LogoPopover'
import { ModalMobileMenu } from './ModalMobileMenu'

export type TMenu = { path: string; label: string | ReactElement; target?: string }
type TNavbar = { nav: TMenu[]; currentPathName: string }

function Navbar({ nav, currentPathName }: TNavbar): ReactElement {
  return (
    <nav className={'yearn--nav'}>
      {nav.map(
        (option): ReactElement => (
          <Link key={option.path} target={option.target} href={option.path}>
            <p className={`yearn--header-nav-item ${currentPathName.startsWith(option.path) ? 'active' : ''}`}>
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
  const { isActive, address, ens, clusters, lensProtocolHandle, openLoginModal } = useWeb3()
  const [walletIdentity, setWalletIdentity] = useState<string | undefined>(undefined)

  useEffect((): void => {
    if (!isActive && address) {
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
  }, [ens, clusters, lensProtocolHandle, address, isActive])

  return (
    <div
      onClick={(): void => {
        if (isActive) {
          openAccountModal?.()
        } else if (!isActive && address) {
          openChainModal?.()
        } else {
          openLoginModal()
        }
      }}
    >
      <p suppressHydrationWarning className={'yearn--header-nav-item text-xs! md:text-sm!'}>
        {walletIdentity ? (
          walletIdentity
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
    const HOME_MENU = { path: '/apps', label: 'Apps' }

    if (pathname.startsWith('/ycrv')) {
      return [...APPS[AppName.YCRV].menu]
    }

    if (pathname.startsWith('/v3')) {
      return [...APPS[AppName.VAULTSV3].menu]
    }

    if (pathname.startsWith('/vaults-beta')) {
      return [...APPS[AppName.BETA].menu]
    }

    if (pathname.startsWith('/vaults')) {
      return [...APPS[AppName.VAULTS].menu]
    }

    if (pathname.startsWith('/veyfi')) {
      return [...APPS[AppName.VEYFI].menu]
    }

    return [
      HOME_MENU,
      { path: 'https://docs.yearn.fi/', label: 'Docs', target: '_blank' },
      { path: 'https://discord.gg/yearn', label: 'Support', target: '_blank' },
      { path: 'https://blog.yearn.fi/', label: 'Blog', target: '_blank' },
      {
        path: 'https://gov.yearn.fi/',
        label: 'Discourse',
        target: '_blank'
      }
    ]
  }, [pathname])

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
          <div className={'direction-row flex items-center justify-start gap-x-6 px-1 py-2 md:py-1'}>
            <div className={'flex justify-center'}>
              <LogoPopover />
            </div>
            <Navbar currentPathName={pathname || ''} nav={menu} />
          </div>
          <div className={'flex w-1/3 items-center justify-end'}>
            <button
              className={'yearn--header-nav-item relative rounded-full p-2 transition-colors'}
              onClick={(): void => setShouldOpenCurtain(true)}
            >
              <IconBell className={'size-4 font-bold transition-colors'} />

              <div className={cl('absolute right-1 top-1 size-2 rounded-full', notificationDotColor)} />
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
