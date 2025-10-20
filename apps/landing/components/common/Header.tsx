import { ModalMobileMenu } from '@lib/components/ModalMobileMenu'
import { IconBurgerPlain } from '@lib/icons/IconBurgerPlain'
import { TypeMarkYearn } from '@lib/icons/TypeMarkYearn'
import { type ReactElement, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import Link from '/src/components/Link'

type TMenu = { path: string; label: string | ReactElement; target?: string }
type TNavbar = { nav: TMenu[]; currentPathName: string }

function Navbar({ nav, currentPathName }: TNavbar): ReactElement {
  return (
    <nav className={'hidden items-center gap-6 md:flex'}>
      {nav.map(
        (option): ReactElement => (
          <Link key={option.path} target={option.target} href={option.path}>
            <p className={`yearn--header-nav-item ${currentPathName === option.path ? 'active' : ''}`}>
              {option?.label || 'Unknown'}
            </p>
          </Link>
        )
      )}
    </nav>
  )
}

export function LandingAppHeader(): ReactElement {
  const location = useLocation()
  const pathname = location.pathname
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

  const menu = useMemo((): TMenu[] => {
    const HOME_MENU = { path: '/apps', label: 'Apps' }

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
  }, [])

  return (
    <div id={'head'} className={'inset-x-0 top-0 z-50 mt-4 w-full md:mt-7'}>
      <div className={'w-full'}>
        <header className={'flex max-w-[1232px] items-center gap-4 py-1 md:justify-between md:px-10! md:py-4'}>
          <div className={'hidden flex-row items-center gap-x-3 md:flex'}>
            <Link href={'/'}>
              <TypeMarkYearn className={'h-6 w-auto'} color={'#E1E1E1'} />
            </Link>
          </div>
          <Navbar currentPathName={pathname || ''} nav={menu} />
          <div className={'flex md:hidden'}>
            <button
              className={'flex size-8 items-center justify-center rounded-full bg-neutral-900/20 p-1.5'}
              onClick={(): void => setIsMenuOpen(!isMenuOpen)}
            >
              <span className={'sr-only'}>{'Open menu'}</span>
              <IconBurgerPlain />
            </button>
          </div>
        </header>
      </div>
      <ModalMobileMenu
        shouldUseWallets={true}
        shouldUseNetworks={true}
        isOpen={isMenuOpen}
        onClose={(): void => setIsMenuOpen(false)}
        supportedNetworks={[]}
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
