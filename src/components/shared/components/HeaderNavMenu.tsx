import { IconChevron } from '@shared/icons/IconChevron'
import { IconVaults } from '@shared/icons/IconVaults'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from '/src/components/Link'
import { DropdownPanel } from './DropdownPanel'
import { APP_GROUPS, type TAppTile } from './YearnApps'

type THeaderNavMenuProps = {
  isHomePage: boolean
  isDarkTheme: boolean
}

type TMenuKey = 'products' | 'tools' | 'resources' | 'community'

type TSocialLink = Pick<TAppTile, 'name' | 'href'>

const SOCIAL_LINKS: TSocialLink[] = [
  { name: 'GitHub', href: 'https://github.com/yearn' },
  { name: 'X (Twitter)', href: 'https://x.com/yearnfi' },
  { name: 'Discord', href: 'https://discord.gg/yearn' }
]

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function getGroupItems(title: string): TAppTile[] {
  return APP_GROUPS.find((group) => group.title === title)?.items ?? []
}

const BASE_PRODUCTS = getGroupItems('Apps')
const TOOLS = getGroupItems('Analytics and Tools')
const RESOURCES = getGroupItems('Resources')
const DEPRECATED = getGroupItems('Deprecated Projects')

function ProductTile({ item, isDark }: { item: TAppTile; isDark: boolean }): ReactElement {
  return (
    <Link href={item.href}>
      <div
        className={cl(
          'flex items-center gap-3 rounded-lg p-3 transition-colors',
          isDark ? 'hover:bg-white/10' : 'hover:bg-neutral-100'
        )}
      >
        <div
          className={cl(
            'flex size-10 items-center justify-center rounded-lg',
            isDark ? 'bg-white/10' : 'bg-neutral-100'
          )}
        >
          {item.icon}
        </div>
        <div className={'flex-1'}>
          <div className={'flex items-center gap-1'}>
            <span className={cl('text-sm font-semibold', isDark ? 'text-white' : 'text-neutral-900')}>{item.name}</span>
            {isExternalHref(item.href) && (
              <span className={cl('text-xs', isDark ? 'text-neutral-400' : 'text-neutral-500')}>{'↗'}</span>
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

function TextItem({ item, isDark }: { item: Pick<TAppTile, 'name' | 'href'>; isDark: boolean }): ReactElement {
  return (
    <Link href={item.href}>
      <div
        className={cl(
          'flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors',
          isDark ? 'text-white hover:bg-white/10' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
        )}
      >
        <span>{item.name}</span>
        {isExternalHref(item.href) && <span className={'text-xs'}>{'↗'}</span>}
      </div>
    </Link>
  )
}

export function HeaderNavMenu({ isHomePage, isDarkTheme }: THeaderNavMenuProps): ReactElement {
  const [activeMenu, setActiveMenu] = useState<TMenuKey | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDarkMenu = isHomePage || isDarkTheme
  const [isDeprecatedExpanded, setIsDeprecatedExpanded] = useState(false)
  const products: TAppTile[] = [
    {
      name: 'Vaults',
      href: '/vaults',
      description: 'Yearn yield vaults',
      icon: <IconVaults className={cl('size-6', isDarkMenu ? 'text-white' : 'text-neutral-900')} />
    },
    ...BASE_PRODUCTS
  ]

  const deprecatedToggleClass = cl(
    'mt-4 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
    isDarkMenu
      ? 'text-neutral-400 hover:bg-white/10 hover:text-white'
      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
  )

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
    closeTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null)
    }, 150)
  }

  const toggleMenu = (menuKey: TMenuKey): void => {
    setActiveMenu((current) => (current === menuKey ? null : menuKey))
  }

  const closeMenu = (): void => {
    setActiveMenu(null)
  }

  const dropdownDarkOverride = isHomePage || undefined

  useEffect(() => {
    if (activeMenu !== 'resources') {
      setIsDeprecatedExpanded(false)
    }
  }, [activeMenu])

  return (
    <div className={'flex items-center gap-3'}>
      <div className={'relative'} onMouseEnter={() => openMenu('products')} onMouseLeave={scheduleClose}>
        <button
          type={'button'}
          onClick={() => toggleMenu('products')}
          className={navTriggerClass(activeMenu === 'products')}
          aria-expanded={activeMenu === 'products'}
        >
          <span>{'Products'}</span>
          <IconChevron className={cl('size-4 transition-transform', activeMenu === 'products' ? 'rotate-180' : '')} />
        </button>
        <DropdownPanel
          isOpen={activeMenu === 'products'}
          onClose={closeMenu}
          anchor={'left'}
          className={'w-[420px]'}
          forceDark={dropdownDarkOverride}
        >
          <div className={'grid grid-cols-2 gap-1'}>
            {products.map((item) => (
              <div key={item.href} onClick={closeMenu}>
                <ProductTile item={item} isDark={isDarkMenu} />
              </div>
            ))}
          </div>
        </DropdownPanel>
      </div>

      <div className={'relative'} onMouseEnter={() => openMenu('tools')} onMouseLeave={scheduleClose}>
        <button
          type={'button'}
          onClick={() => toggleMenu('tools')}
          className={navTriggerClass(activeMenu === 'tools')}
          aria-expanded={activeMenu === 'tools'}
        >
          <span>{'Tools'}</span>
          <IconChevron className={cl('size-4 transition-transform', activeMenu === 'tools' ? 'rotate-180' : '')} />
        </button>
        <DropdownPanel
          isOpen={activeMenu === 'tools'}
          onClose={closeMenu}
          anchor={'left'}
          className={'w-[320px]'}
          forceDark={dropdownDarkOverride}
        >
          <div className={'grid grid-cols-2 gap-1'}>
            {TOOLS.map((item) => (
              <div key={item.href} onClick={closeMenu}>
                <TextItem item={item} isDark={isDarkMenu} />
              </div>
            ))}
          </div>
        </DropdownPanel>
      </div>

      <div className={'relative'} onMouseEnter={() => openMenu('resources')} onMouseLeave={scheduleClose}>
        <button
          type={'button'}
          onClick={() => toggleMenu('resources')}
          className={navTriggerClass(activeMenu === 'resources')}
          aria-expanded={activeMenu === 'resources'}
        >
          <span>{'Resources'}</span>
          <IconChevron className={cl('size-4 transition-transform', activeMenu === 'resources' ? 'rotate-180' : '')} />
        </button>
        <DropdownPanel
          isOpen={activeMenu === 'resources'}
          onClose={closeMenu}
          anchor={'left'}
          className={'w-[360px]'}
          forceDark={dropdownDarkOverride}
        >
          <div className={'flex flex-col'}>
            <div className={'flex flex-col'}>
              {RESOURCES.map((item) => (
                <div key={item.href} onClick={closeMenu}>
                  <TextItem item={item} isDark={isDarkMenu} />
                </div>
              ))}
            </div>

            <button
              type={'button'}
              onClick={() => setIsDeprecatedExpanded((prev) => !prev)}
              className={deprecatedToggleClass}
            >
              <span>{'Deprecated'}</span>
              <IconChevron className={cl('size-3 transition-transform', isDeprecatedExpanded ? 'rotate-180' : '')} />
            </button>
            {isDeprecatedExpanded && (
              <div className={'mt-1 flex flex-col'}>
                {DEPRECATED.map((item) => (
                  <div key={item.href} onClick={closeMenu}>
                    <TextItem item={item} isDark={isDarkMenu} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DropdownPanel>
      </div>

      <div className={'relative'} onMouseEnter={() => openMenu('community')} onMouseLeave={scheduleClose}>
        <button
          type={'button'}
          onClick={() => toggleMenu('community')}
          className={navTriggerClass(activeMenu === 'community')}
          aria-expanded={activeMenu === 'community'}
        >
          <span>{'Community'}</span>
          <IconChevron className={cl('size-4 transition-transform', activeMenu === 'community' ? 'rotate-180' : '')} />
        </button>
        <DropdownPanel
          isOpen={activeMenu === 'community'}
          onClose={closeMenu}
          anchor={'left'}
          className={'w-[260px]'}
          forceDark={dropdownDarkOverride}
        >
          <div className={'flex flex-col'}>
            {SOCIAL_LINKS.map((item) => (
              <div key={item.href} onClick={closeMenu}>
                <TextItem item={item} isDark={isDarkMenu} />
              </div>
            ))}
          </div>
        </DropdownPanel>
      </div>
    </div>
  )
}
