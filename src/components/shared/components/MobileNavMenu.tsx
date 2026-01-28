import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconClose } from '@shared/icons/IconClose'
import { IconDiscord } from '@shared/icons/IconDiscord'
import { IconMoon } from '@shared/icons/IconMoon'
import { IconSun } from '@shared/icons/IconSun'
import { IconTwitter } from '@shared/icons/IconTwitter'
import { IconWallet } from '@shared/icons/IconWallet'
import { LogoGithub } from '@shared/icons/LogoGithub'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import Link from '/src/components/Link'
import { APP_GROUPS, type TAppTile } from './YearnApps'

type TNavItem = Pick<TAppTile, 'name' | 'href'>

const COMMUNITY_LINKS: TNavItem[] = [
  { name: 'Discord', href: 'https://discord.gg/yearn' },
  { name: 'GitHub', href: 'https://github.com/yearn' },
  { name: 'X (Twitter)', href: 'https://x.com/yearnfi' }
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

type TMobileNavMenuProps = {
  isOpen: boolean
  onClose: () => void
  pathname: string
  isDarkTheme: boolean
  onThemeToggle: () => void
  onAccountClick: () => void
  notificationStatus: 'pending' | 'submitted' | 'success' | 'error' | null
  walletIdentity?: string
}

export function MobileNavMenu({
  isOpen,
  onClose,
  pathname,
  isDarkTheme,
  onThemeToggle,
  onAccountClick,
  notificationStatus,
  walletIdentity
}: TMobileNavMenuProps): ReactElement {
  const [isDeprecatedExpanded, setIsDeprecatedExpanded] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setIsDeprecatedExpanded(false)
    }
  }, [isOpen])

  function navItemClass(isActive: boolean, isExternal: boolean): string {
    return cl(
      'flex min-h-[44px] w-full items-center rounded-lg px-4 text-lg font-medium transition-colors',
      isExternal ? 'justify-between' : '',
      isActive ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-surface-tertiary'
    )
  }

  const notificationDotColor = (() => {
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
  })()

  const products: TNavItem[] = [{ name: 'Vaults', href: '/vaults' }, ...BASE_PRODUCTS]
  const sectionHeaderClass = 'px-4 text-xs font-semibold uppercase tracking-wider text-text-tertiary'

  return (
    <Transition show={isOpen} as={'div'}>
      <Dialog as={'div'} className={'fixed inset-0 z-[100] overflow-y-auto'} onClose={onClose}>
        <TransitionChild
          as={'div'}
          enter={'ease-out duration-300'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'ease-in duration-200'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-modal-overlay backdrop-blur-sm'} />
        </TransitionChild>

        <TransitionChild
          as={'div'}
          enter={'ease-out duration-300'}
          enterFrom={'opacity-0 translate-y-4'}
          enterTo={'opacity-100 translate-y-0'}
          leave={'ease-in duration-200'}
          leaveFrom={'opacity-100 translate-y-0'}
          leaveTo={'opacity-0 translate-y-4'}
        >
          <div className={'relative flex min-h-screen w-full flex-col bg-surface'}>
            <div className={'flex h-[var(--header-height)] items-center justify-end border-b border-border px-4'}>
              <button
                onClick={onClose}
                className={
                  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-surface-secondary'
                }
                aria-label={'Close navigation menu'}
              >
                <IconClose className={'size-6'} />
              </button>
            </div>

            <div className={'flex flex-1 flex-col px-4 py-6'}>
              <nav className={'flex flex-col gap-6'}>
                <div className={'flex flex-col gap-2'}>
                  <h3 className={sectionHeaderClass}>{'Products'}</h3>
                  {products.map((item) => {
                    const isExternal = isExternalHref(item.href)
                    const isActive = !isExternal && pathname.startsWith(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={navItemClass(isActive, isExternal)}
                      >
                        <span>{item.name}</span>
                        {isExternal && <span className={'text-text-secondary'}>{'↗'}</span>}
                      </Link>
                    )
                  })}
                </div>

                <div className={'flex flex-col gap-2'}>
                  <h3 className={sectionHeaderClass}>{'Tools'}</h3>
                  {TOOLS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={navItemClass(false, isExternalHref(item.href))}
                    >
                      <span>{item.name}</span>
                      {isExternalHref(item.href) && <span className={'text-text-secondary'}>{'↗'}</span>}
                    </Link>
                  ))}
                </div>

                <div className={'flex flex-col gap-2'}>
                  <h3 className={sectionHeaderClass}>{'Resources'}</h3>
                  {RESOURCES.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={navItemClass(false, isExternalHref(item.href))}
                    >
                      <span>{item.name}</span>
                      {isExternalHref(item.href) && <span className={'text-text-secondary'}>{'↗'}</span>}
                    </Link>
                  ))}

                  <button
                    type={'button'}
                    onClick={() => setIsDeprecatedExpanded((prev) => !prev)}
                    className={cl(
                      'mt-4 flex min-h-[44px] w-full items-center justify-between rounded-lg px-4 text-sm font-semibold uppercase tracking-wider transition-colors',
                      'text-text-secondary hover:bg-surface-tertiary'
                    )}
                  >
                    <span>{'Deprecated'}</span>
                    <IconChevron
                      className={cl('size-4 transition-transform', isDeprecatedExpanded ? 'rotate-180' : '')}
                    />
                  </button>
                  {isDeprecatedExpanded &&
                    DEPRECATED.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={navItemClass(false, isExternalHref(item.href))}
                      >
                        <span>{item.name}</span>
                        {isExternalHref(item.href) && <span className={'text-text-secondary'}>{'↗'}</span>}
                      </Link>
                    ))}
                </div>

                <div className={'flex flex-col gap-2'}>
                  <h3 className={sectionHeaderClass}>{'Community'}</h3>
                  {COMMUNITY_LINKS.map((item) => (
                    <Link key={item.href} href={item.href} onClick={onClose} className={navItemClass(false, true)}>
                      <span>{item.name}</span>
                      <span className={'text-text-secondary'}>{'↗'}</span>
                    </Link>
                  ))}
                </div>
              </nav>

              <div className={'my-6 h-px bg-border'} />

              <div className={'flex flex-col gap-2'}>
                <button
                  onClick={() => {
                    onAccountClick()
                  }}
                  className={
                    'relative flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-lg font-medium text-text-primary transition-colors hover:bg-surface-tertiary'
                  }
                >
                  <IconWallet className={'size-5'} />
                  <span>{walletIdentity || 'Wallet'}</span>
                  {notificationStatus && (
                    <div className={cl('absolute right-4 size-2.5 rounded-full', notificationDotColor)} />
                  )}
                </button>

                <button
                  onClick={() => {
                    onThemeToggle()
                  }}
                  className={
                    'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-lg font-medium text-text-primary transition-colors hover:bg-surface-tertiary'
                  }
                >
                  {isDarkTheme ? <IconSun className={'size-5'} /> : <IconMoon className={'size-5'} />}
                  <span>{isDarkTheme ? 'Light mode' : 'Dark mode'}</span>
                </button>
              </div>

              <div className={'my-6 h-px bg-border'} />

              <div className={'mt-auto pt-6'}>
                <div className={'flex items-center justify-center gap-4'}>
                  <Link
                    href={'https://discord.com/invite/yearn'}
                    target={'_blank'}
                    className={
                      'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface-secondary p-2.5 transition-colors hover:bg-surface-tertiary'
                    }
                    aria-label={'Discord'}
                  >
                    <IconDiscord className={'size-6 text-text-primary'} />
                  </Link>
                  <Link
                    href={'https://github.com/yearn'}
                    target={'_blank'}
                    className={
                      'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface-secondary p-2.5 transition-colors hover:bg-surface-tertiary'
                    }
                    aria-label={'GitHub'}
                  >
                    <LogoGithub className={'size-6 text-text-primary'} />
                  </Link>
                  <Link
                    href={'https://x.com/yearnfi'}
                    target={'_blank'}
                    className={
                      'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface-secondary p-2.5 transition-colors hover:bg-surface-tertiary'
                    }
                    aria-label={'Twitter'}
                  >
                    <IconTwitter className={'size-6 text-text-primary'} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  )
}
