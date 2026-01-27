import { useThemePreference } from '@hooks/useThemePreference'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconDiscord } from '@shared/icons/IconDiscord'
import { IconTwitter } from '@shared/icons/IconTwitter'
import { LogoGithub } from '@shared/icons/LogoGithub'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import Link from '/src/components/Link'
import { DropdownPanel } from './DropdownPanel'
import { APP_GROUPS, type TAppTile } from './YearnApps'

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function findGroupItems(title: string): TAppTile[] {
  return APP_GROUPS.find((g) => g.title === title)?.items ?? []
}

const APPS = findGroupItems('Apps')
const TOOLS = findGroupItems('Analytics and Tools')
const RESOURCES = findGroupItems('Resources')
const DEPRECATED = findGroupItems('Deprecated Projects')

function AppTile({ item, isDark }: { item: TAppTile; isDark: boolean }): ReactElement {
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

function LinkItem({ item, isDark }: { item: TAppTile; isDark: boolean }): ReactElement {
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

type TLauncherDropdownProps = {
  isOpen: boolean
  onClose: () => void
  forceDark?: boolean
}

export function LauncherDropdown({ isOpen, onClose, forceDark }: TLauncherDropdownProps): ReactElement {
  const location = useLocation()
  const previousPathname = useRef(location.pathname)
  const [isDeprecatedExpanded, setIsDeprecatedExpanded] = useState(false)
  const themePreference = useThemePreference()
  const isDarkTheme = forceDark ?? themePreference !== 'light'

  useEffect(() => {
    const pathnameChanged = previousPathname.current !== location.pathname
    previousPathname.current = location.pathname

    if (pathnameChanged && isOpen) {
      onClose()
    }
  }, [isOpen, location.pathname, onClose])

  useEffect(() => {
    if (!isOpen) {
      setIsDeprecatedExpanded(false)
    }
  }, [isOpen])

  const sectionHeaderClass = cl(
    'mb-2 px-2 text-xs font-semibold uppercase tracking-wider',
    isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'
  )

  const dividerClass = cl('h-px', isDarkTheme ? 'bg-white/10' : 'bg-neutral-200')

  const socialIconClass = cl(
    'flex size-8 items-center justify-center rounded-lg transition-colors',
    isDarkTheme
      ? 'text-neutral-400 hover:bg-white/10 hover:text-white'
      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
  )

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      anchor={'left'}
      className={'w-[420px] max-md:w-full'}
      forceDark={forceDark}
    >
      <div className={'flex flex-col gap-4'}>
        <div>
          <h3 className={sectionHeaderClass}>{'Apps'}</h3>
          <div className={'grid grid-cols-2 gap-1'}>
            {APPS.map((item) => (
              <div key={item.href} onClick={onClose}>
                <AppTile item={item} isDark={isDarkTheme} />
              </div>
            ))}
          </div>
        </div>

        <div className={dividerClass} />

        <div className={'grid grid-cols-2 gap-4'}>
          <div>
            <h3 className={sectionHeaderClass}>{'Tools'}</h3>
            <div className={'flex flex-col'}>
              {TOOLS.map((item) => (
                <div key={item.href} onClick={onClose}>
                  <LinkItem item={item} isDark={isDarkTheme} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className={sectionHeaderClass}>{'Resources'}</h3>
            <div className={'flex flex-col'}>
              {RESOURCES.map((item) => (
                <div key={item.href} onClick={onClose}>
                  <LinkItem item={item} isDark={isDarkTheme} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={dividerClass} />

        <div>
          <div className={'flex items-center justify-between'}>
            <button
              type={'button'}
              onClick={() => setIsDeprecatedExpanded(!isDeprecatedExpanded)}
              className={cl(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                isDarkTheme
                  ? 'text-neutral-400 hover:bg-white/10 hover:text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
              )}
            >
              <span>{'Deprecated'}</span>
              <IconChevron className={cl('size-3 transition-transform', isDeprecatedExpanded ? 'rotate-180' : '')} />
            </button>

            <div className={'flex items-center gap-2'}>
              <Link href={'https://github.com/yearn'}>
                <div className={socialIconClass}>
                  <LogoGithub className={'size-5'} />
                </div>
              </Link>
              <Link href={'https://x.com/yearnfi'}>
                <div className={socialIconClass}>
                  <IconTwitter className={'size-5'} />
                </div>
              </Link>
              <Link href={'https://discord.gg/yearn'}>
                <div className={socialIconClass}>
                  <IconDiscord className={'size-5'} />
                </div>
              </Link>
            </div>
          </div>

          {isDeprecatedExpanded && (
            <div className={'mt-2 flex flex-wrap gap-x-1'}>
              {DEPRECATED.map((item) => (
                <div key={item.href} onClick={onClose}>
                  <LinkItem item={item} isDark={isDarkTheme} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DropdownPanel>
  )
}
