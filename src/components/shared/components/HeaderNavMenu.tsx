import { IconChevron } from '@shared/icons/IconChevron'
import { IconDiscord } from '@shared/icons/IconDiscord'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { IconTelegram } from '@shared/icons/IconTelegram'
import { IconTwitter } from '@shared/icons/IconTwitter'
import { LogoCuration } from '@shared/icons/LogoCuration'
import { LogoGithub } from '@shared/icons/LogoGithub'
import { LogoYearn } from '@shared/icons/LogoYearn'
import { LogoYearnMark } from '@shared/icons/LogoYearnMark'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { useRef, useState } from 'react'
import Link from '/src/components/Link'
import { DropdownPanel } from './DropdownPanel'
import type { TAppTile } from './YearnApps'

type THeaderNavMenuProps = {
  isHomePage: boolean
  isDarkTheme: boolean
}

type TMenuKey = 'products' | 'resources'

type TNavTile = Pick<TAppTile, 'name' | 'href' | 'description'> & {
  icon?: ReactElement
  iconWrapperClass?: string
}

const BASE_YEARN_ASSET_URI = import.meta.env?.VITE_BASE_YEARN_ASSETS_URI ?? ''

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function NavTile({ item, isDark }: { item: TNavTile; isDark: boolean }): ReactElement {
  const hasIcon = Boolean(item.icon)
  const iconWrapperClass =
    item.iconWrapperClass ?? cl(isDark ? 'bg-[#0a0a0a] text-neutral-200' : 'bg-white text-neutral-700')

  return (
    <Link href={item.href}>
      <div
        className={cl(
          'group/nav-item flex items-center rounded-lg p-2 transition-colors',
          hasIcon ? 'gap-3' : 'gap-0',
          isDark ? 'hover:bg-white/10' : 'hover:bg-neutral-100'
        )}
      >
        {hasIcon && (
          <div className={cl('flex size-8 items-center justify-center rounded-lg', iconWrapperClass)}>{item.icon}</div>
        )}
        <div className={cl('flex-1', hasIcon ? '' : 'pl-1')}>
          <div className={'flex w-full items-center justify-between gap-2'}>
            <span className={cl('truncate text-sm font-semibold', isDark ? 'text-white' : 'text-neutral-900')}>
              {item.name}
            </span>
            {isExternalHref(item.href) && (
              <IconLinkOut
                className={cl(
                  'size-3 opacity-0 transition-opacity group-hover/nav-item:opacity-100',
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                )}
              />
            )}
          </div>
          {item.description && (
            <p className={cl('text-xs', isDark ? 'text-neutral-400' : 'text-neutral-500')}>{item.description}</p>
          )}
        </div>
      </div>
    </Link>
  )
}

export function HeaderNavMenu({ isHomePage, isDarkTheme }: THeaderNavMenuProps): ReactElement {
  const [activeMenu, setActiveMenu] = useState<TMenuKey | null>(null)
  const [pinnedMenu, setPinnedMenu] = useState<TMenuKey | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDarkMenu = isHomePage || isDarkTheme
  const neutralImageClass = cl('size-5 grayscale', isDarkMenu ? 'invert brightness-125' : 'opacity-90')
  const neutralIconForeground = isDarkMenu ? 'text-white' : 'text-neutral-700'
  const products: TNavTile[] = [
    {
      name: 'yVaults',
      href: '/vaults',
      description: 'Yield-Generating Vaults',
      icon: <LogoYearnMark className={'size-6 text-primary'} />
    },
    {
      name: 'Curation',
      href: '/curation',
      description: 'Lending Market Curation',
      icon: <LogoCuration className={'size-11'} back={'text-transparent'} front={'text-primary'} />
    },
    {
      name: 'yCRV',
      href: 'https://ycrv.yearn.fi',
      description: 'veCRV Liquid Locker',
      icon: (
        <img
          alt={'yCRV'}
          className={'size-6'}
          src={`${BASE_YEARN_ASSET_URI}/tokens/1/0xfcc5c47be19d06bf83eb04298b026f81069ff65b/logo-128.png`}
          loading={'eager'}
          decoding={'async'}
        />
      )
    },
    {
      name: 'yYB',
      href: 'https://yyb.yearn.fi',
      description: 'veYB Liquid Locker',
      icon: <img alt={'yYB'} className={'size-6'} src={'/yYB-logo.svg'} loading={'eager'} decoding={'async'} />
    },
    {
      name: 'stYFI',
      href: 'https://styfi.yearn.fi',
      description: 'YFI Staking',
      icon: <img alt={'stYFI'} className={'size-6'} src={'/stYFI-logo.svg'} loading={'eager'} decoding={'async'} />
    }
  ]

  const infoItems: TNavTile[] = [
    {
      name: 'Docs',
      href: 'https://docs.yearn.fi/',
      description: 'Yearn Knowledge Base',
      icon: (
        <img
          alt={'GitBook'}
          className={neutralImageClass}
          src={'/GitBook%20-%20Icon%20-%20Dark.svg'}
          loading={'eager'}
          decoding={'async'}
        />
      )
    },
    {
      name: 'X (Twitter)',
      href: 'https://x.com/yearnfi',
      description: 'Official Yearn News Feed',
      icon: <IconTwitter className={cl('size-5', neutralIconForeground)} />
    },
    {
      name: 'Github',
      href: 'https://github.com/yearn',
      description: 'Yearn Codebase',
      icon: <LogoGithub className={cl('size-5', neutralIconForeground)} />
    },
    {
      name: 'Blog',
      href: 'https://blog.yearn.fi/',
      description: 'Articles about Yearn',
      icon: (
        <img alt={'Blog'} className={neutralImageClass} src={'/paragraph.svg'} loading={'eager'} decoding={'async'} />
      )
    },
    {
      name: 'Brand Assets',
      href: 'https://brand.yearn.fi',
      description: 'Yearn Brand Resources',
      icon: (
        <LogoYearn
          width={20}
          height={20}
          className={'size-5'}
          back={isDarkMenu ? 'text-neutral-200' : 'text-neutral-700'}
          front={'text-white'}
        />
      )
    }
  ]

  const toolItems: TNavTile[] = [
    {
      name: 'PowerGlove',
      href: 'https://powerglove.yearn.fi',
      description: 'Vault Analytics',
      icon: undefined
    },
    {
      name: 'Kong',
      href: 'https://kong.yearn.fi',
      description: 'Vault Data',
      icon: undefined
    },
    {
      name: 'Kalani',
      href: 'https://kalani.yearn.fi',
      description: 'Vault Management Interface',
      icon: undefined
    },
    {
      name: 'yFactory',
      href: 'https://factory.yearn.fi',
      description: 'LP token Vault Creation',
      icon: undefined
    },
    {
      name: 'APR Oracle',
      href: 'https://oracle.yearn.fi',
      description: 'Projected Vault APY Tool',
      icon: undefined
    }
  ]

  const communityItems: TNavTile[] = [
    {
      name: 'Support',
      href: 'https://discord.gg/yearn',
      description: 'Yearn Discord Server',
      icon: <IconDiscord className={cl('size-5', neutralIconForeground)} />
    },
    {
      name: 'Telegram Chat',
      href: 'https://t.me/yearnfinance',
      description: 'Discuss Yearn on Telegram',
      icon: <IconTelegram className={cl('size-5', neutralIconForeground)} />
    },
    {
      name: 'Governance',
      href: 'https://gov.yearn.fi/',
      description: 'Yearn Discussion Forum',
      icon: (
        <img
          alt={'Discourse'}
          className={neutralImageClass}
          src={'/discourse-icon.svg'}
          loading={'eager'}
          decoding={'async'}
        />
      )
    }
  ]

  function navTriggerClass(isActive: boolean): string {
    const baseClass = 'cursor-pointer inline-flex items-center gap-1 text-base font-medium transition-colors relative'
    if (isHomePage) {
      return cl(baseClass, isActive ? 'text-white' : 'text-neutral-400 hover:text-white')
    }
    return cl(baseClass, isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary')
  }

  const openMenu = (menuKey: TMenuKey): void => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setActiveMenu(menuKey)
  }

  const scheduleClose = (): void => {
    if (pinnedMenu) return
    closeTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null)
    }, 150)
  }

  const toggleMenu = (menuKey: TMenuKey): void => {
    if (pinnedMenu === menuKey) {
      setPinnedMenu(null)
      setActiveMenu(null)
      return
    }
    setPinnedMenu(menuKey)
    setActiveMenu(menuKey)
  }

  const closeMenu = (): void => {
    setActiveMenu(null)
    setPinnedMenu(null)
  }

  const dropdownDarkOverride = isHomePage || undefined

  const handleHoverMenu = (menuKey: TMenuKey): void => {
    if (pinnedMenu && pinnedMenu !== menuKey) {
      setPinnedMenu(null)
    }
    openMenu(menuKey)
  }

  return (
    <div className={'flex items-center gap-3'}>
      <div className={'relative'} onMouseEnter={() => handleHoverMenu('products')} onMouseLeave={scheduleClose}>
        <button
          type={'button'}
          onClick={() => toggleMenu('products')}
          className={cl('group', navTriggerClass(activeMenu === 'products'))}
          aria-expanded={activeMenu === 'products'}
        >
          <span>{'Ecosystem'}</span>
          <IconChevron
            className={cl(
              'size-4 transition-transform group-hover:rotate-180',
              activeMenu === 'products' ? 'rotate-180' : ''
            )}
          />
        </button>
        <DropdownPanel
          isOpen={activeMenu === 'products'}
          onClose={closeMenu}
          anchor={'left'}
          className={'w-[520px] max-w-[calc(100vw-2rem)]'}
          forceDark={dropdownDarkOverride}
        >
          <div className={'grid grid-cols-1 gap-3 md:grid-cols-2'}>
            <div className={'flex flex-2 flex-col gap-3'}>
              <p
                className={cl(
                  'text-xs pl-4 font-semibold uppercase tracking-[0.2em]',
                  isDarkMenu ? 'text-neutral-400' : 'text-neutral-500'
                )}
              >
                {'Products'}
              </p>
              <div className={'flex flex-col gap-0'}>
                {products.map((item) => (
                  <div key={item.href} onClick={closeMenu}>
                    <NavTile item={item} isDark={isDarkMenu} />
                  </div>
                ))}
              </div>
            </div>

            <div className={'flex flex-col gap-3 flex-1'}>
              <p
                className={cl(
                  'text-xs pl-4 font-semibold uppercase tracking-[0.2em]',
                  isDarkMenu ? 'text-neutral-400' : 'text-neutral-500'
                )}
              >
                {'Tools'}
              </p>
              <div className={'flex flex-col gap-0'}>
                {toolItems.map((item) => (
                  <div key={item.href} onClick={closeMenu}>
                    <NavTile item={item} isDark={isDarkMenu} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DropdownPanel>
      </div>

      <div className={'relative'} onMouseEnter={() => handleHoverMenu('resources')} onMouseLeave={scheduleClose}>
        <button
          type={'button'}
          onClick={() => toggleMenu('resources')}
          className={cl('group', navTriggerClass(activeMenu === 'resources'))}
          aria-expanded={activeMenu === 'resources'}
        >
          <span>{'Resources'}</span>
          <IconChevron
            className={cl(
              'size-4 transition-transform group-hover:rotate-180',
              activeMenu === 'resources' ? 'rotate-180' : ''
            )}
          />
        </button>
        <DropdownPanel
          isOpen={activeMenu === 'resources'}
          onClose={closeMenu}
          anchor={'left'}
          className={'w-[520px] max-w-[calc(100vw-2rem)]'}
          forceDark={dropdownDarkOverride}
        >
          <div className={'grid grid-cols-1 gap-3 md:grid-cols-2'}>
            <div className={'flex flex-col gap-3'}>
              <p
                className={cl(
                  'text-xs pl-4 font-semibold uppercase tracking-[0.2em]',
                  isDarkMenu ? 'text-neutral-400' : 'text-neutral-500'
                )}
              >
                {'Information'}
              </p>
              <div className={'flex flex-col gap-0'}>
                {infoItems.map((item) => (
                  <div key={item.href} onClick={closeMenu}>
                    <NavTile item={item} isDark={isDarkMenu} />
                  </div>
                ))}
              </div>
            </div>

            <div className={'flex flex-col gap-3'}>
              <p
                className={cl(
                  'text-xs pl-4 font-semibold uppercase tracking-[0.2em]',
                  isDarkMenu ? 'text-neutral-400' : 'text-neutral-500'
                )}
              >
                {'Community'}
              </p>
              <div className={'flex flex-col gap-1'}>
                {communityItems.map((item) => (
                  <div key={item.href} onClick={closeMenu}>
                    <NavTile item={item} isDark={isDarkMenu} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DropdownPanel>
      </div>
    </div>
  )
}
