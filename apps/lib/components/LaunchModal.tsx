import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { IconClose } from '@lib/icons/IconClose'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Link from '/src/components/Link'

import { LogoYearn } from '../icons/LogoYearn'
import { APP_GROUPS, type TAppTile } from './YearnApps'

function TileIcon({ icon, forceDark }: { icon?: ReactElement; forceDark: boolean }): ReactElement {
  return (
    <div
      className={cl(
        'flex size-8 items-center justify-center rounded-full',
        forceDark ? 'bg-[#0F172A] text-white' : 'bg-white text-neutral-900 dark:bg-[#0F172A] dark:text-white'
      )}
    >
      {icon ?? <LogoYearn className={'size-10! max-h-10! max-w-10!'} front={'text-white'} back={'text-primary'} />}
    </div>
  )
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function matchesPathname(pathnames: string[] | undefined, pathname: string): boolean {
  if (!pathnames) {
    return false
  }

  return pathnames.some((path) => {
    if (path === '/') {
      return pathname === '/'
    }

    return pathname.startsWith(path)
  })
}

function isTileActive(tile: TAppTile, pathname: string, currentHost: string): boolean {
  const matchesHost = tile.hosts?.some((host) => currentHost.includes(host.toLowerCase())) ?? false
  const matchesPath = matchesPathname(tile.pathnames, pathname)

  return matchesHost || matchesPath
}

export function LaunchModal(): ReactElement {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const previousPathname = useRef(location.pathname)
  const pushedHistory = useRef(false)
  const [activeGroupTitle, setActiveGroupTitle] = useState(APP_GROUPS[0]?.title ?? '')
  const pathname = location.pathname
  const forceDark = useMemo(() => pathname.startsWith('/v3'), [pathname])

  const currentHost = useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.location.host.toLowerCase()
  }, [])

  const activeGroup = useMemo(
    () => APP_GROUPS.find((group) => group.title === activeGroupTitle) ?? APP_GROUPS[0],
    [activeGroupTitle]
  )

  const handleClose = useCallback((): void => {
    if (pushedHistory.current) {
      pushedHistory.current = false
      window.history.back()
    } else {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (previousPathname.current !== location.pathname && isOpen) {
      previousPathname.current = location.pathname
      pushedHistory.current = false
      setIsOpen(false)
      return
    }

    previousPathname.current = location.pathname
  }, [isOpen, location.pathname])

  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: 'launch' }, '')
      pushedHistory.current = true

      const handlePopState = (): void => {
        pushedHistory.current = false
        setIsOpen(false)
      }

      window.addEventListener('popstate', handlePopState)

      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    } else {
      setActiveGroupTitle(APP_GROUPS[0]?.title ?? '')
    }

    return undefined
  }, [isOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isOpen) {
      return
    }

    const scrollY = window.scrollY
    const blockedKeys = new Set([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])

    const isScrollableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) {
        return false
      }
      const scrollable = target.closest('[data-launch-scrollable="true"]')
      if (!scrollable) {
        return false
      }
      return scrollable.scrollHeight > scrollable.clientHeight
    }

    const handleScroll = (): void => {
      if (window.scrollY !== scrollY) {
        window.scrollTo(0, scrollY)
      }
    }

    const handleWheel = (event: WheelEvent): void => {
      if (isScrollableTarget(event.target)) {
        return
      }
      event.preventDefault()
    }

    const handleTouchMove = (event: TouchEvent): void => {
      if (isScrollableTarget(event.target)) {
        return
      }
      event.preventDefault()
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!blockedKeys.has(event.key)) {
        return
      }
      if (isScrollableTarget(document.activeElement)) {
        return
      }
      event.preventDefault()
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('keydown', handleKeyDown)
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  const handleLinkClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>): void => {
      if (event.defaultPrevented) {
        return
      }

      if (event.button !== 0) {
        return
      }

      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return
      }

      const href = event.currentTarget.getAttribute('href')
      const isExternal = href && isExternalHref(href)

      if (isExternal) {
        handleClose()
      } else {
        pushedHistory.current = false
        setIsOpen(false)
      }
    },
    [handleClose]
  )

  const handleSelectGroup = useCallback((title: string): void => {
    setActiveGroupTitle(title)
  }, [])

  return (
    <>
      <button
        type={'button'}
        className={'z-20 flex size-8 items-center justify-center rounded-full transition-colors hover:opacity-80'}
        aria-haspopup={'dialog'}
        aria-expanded={isOpen}
        onClick={(): void => setIsOpen(true)}
      >
        <span className={'sr-only'}>{'Open Yearn navigation'}</span>
        <TileIcon
          forceDark={forceDark}
          icon={<LogoYearn className={'size-8! max-h-8! max-w-8!'} front={'text-white'} back={'text-primary'} />}
        />
      </button>

      <Transition show={isOpen} as={Fragment}>
        <Dialog as={'div'} className={'fixed inset-0 z-[9999] overflow-y-auto'} static onClose={handleClose}>
          <div className={'flex min-h-full items-center justify-center py-6'}>
            <TransitionChild
              as={Fragment}
              enter={'ease-out duration-150'}
              enterFrom={'opacity-0'}
              enterTo={'opacity-100'}
              leave={'ease-in duration-150'}
              leaveFrom={'opacity-100'}
              leaveTo={'opacity-0'}
            >
              <div className={'fixed inset-0 bg-black/60 backdrop-blur-[2px]'} aria-hidden />
            </TransitionChild>

            <TransitionChild
              as={Fragment}
              enter={'ease-out duration-150'}
              enterFrom={'opacity-0 translate-y-6'}
              enterTo={'opacity-100 translate-y-0'}
              leave={'ease-in duration-75'}
              leaveFrom={'opacity-100 translate-y-0'}
              leaveTo={'opacity-0 translate-y-2'}
            >
              <Dialog.Panel
                className={cl(
                  'relative w-full max-w-6xl transform overflow-hidden rounded-3xl border p-6 shadow-2xl focus:outline-none sm:p-8',
                  forceDark
                    ? 'border-primary/30 bg-[#050A29] text-white'
                    : 'border-neutral-100 bg-white text-neutral-900 dark:border-primary/30 dark:bg-neutral-0 dark:text-white'
                )}
              >
                <div className={'flex w-full justify-end'}>
                  {/* <div>
                    <Dialog.Title className={'text-xl font-semibold sm:text-2xl'}>{'Explore Yearn'}</Dialog.Title>
                    <p className={'mt-1 text-sm text-neutral-200 dark:text-neutral-700'}>
                      {'Jump to Yearn apps, internal tools, or community resources.'}
                    </p>
                  </div> */}
                  <button
                    type={'button'}
                    onClick={handleClose}
                    className={cl(
                      'flex size-6 items-center justify-center rounded-full border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      forceDark
                        ? 'bg-[#070A1C] text-neutral-700 hover:bg-[#1a2e5e]'
                        : 'bg-neutral-0 border-1 border-neutral-500 text-neutral-700 hover:bg-neutral-200 dark:hover:text-neutral-700'
                    )}
                  >
                    <span className={'sr-only'}>{'Close'}</span>
                    <IconClose className={'size-4'} />
                  </button>
                </div>

                <div className={'mt-6 flex flex-col gap-6 lg:flex-row'}>
                  <div className={'flex flex-row gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-3 lg:pb-0 lg:pr-2'}>
                    {APP_GROUPS.map((group) => {
                      const isActive = group.title === activeGroupTitle

                      return (
                        <button
                          key={group.title}
                          type={'button'}
                          onClick={(): void => handleSelectGroup(group.title)}
                          className={cl(
                            'whitespace-nowrap rounded-2xl border px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.25em] transition-colors',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            isActive
                              ? forceDark
                                ? 'border-primary bg-primary/10 text-white'
                                : 'border-primary bg-primary/10 text-primary dark:bg-primary/20 dark:text-white'
                              : forceDark
                                ? 'border-transparent bg-transparent text-neutral-500 hover:bg-primary/10 hover:border-primary/70 hover:text-white'
                                : 'border-transparent bg-transparent text-neutral-600 hover:border-primary/70 hover:bg-neutral-50 dark:text-neutral-500 dark:hover:border-primary dark:hover:bg-primary/10'
                          )}
                          aria-pressed={isActive}
                        >
                          {group.title}
                        </button>
                      )
                    })}
                  </div>

                  <div
                    data-launch-scrollable={'true'}
                    className={cl(
                      'flex-1 overflow-y-auto rounded-3xl p-4 sm:p-6',
                      forceDark ? 'border-[#1C264F] bg-[#050A29]' : 'border-neutral-200 bg-white dark:bg-neutral-0'
                    )}
                    style={{ minHeight: '400px', maxHeight: '70vh' }}
                  >
                    <div className={'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
                      {activeGroup?.items.map((item) => {
                        const active = isTileActive(item, pathname, currentHost)
                        const external = isExternalHref(item.href)

                        return (
                          <Link key={item.href} href={item.href} onClick={handleLinkClick}>
                            <div
                              data-active={active}
                              className={cl(
                                'group relative flex flex-row items-center gap-3 rounded-xl border p-4 align-middle',
                                forceDark
                                  ? 'border-primary/20 bg-transparent hover:bg-primary/5 hover:border-primary/70'
                                  : 'border-neutral-200 bg-neutral-0 hover:border-primary/70 hover:bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-0 dark:hover:bg-primary/10',
                                'data-[active=true]:border-primary! data-[active=true]:shadow-[0_0_0_2px_rgba(62,132,255,0.2)]',
                                'active:border-primary!',
                                forceDark ? 'active:bg-[#0F172A]' : 'active:bg-neutral-100 dark:active:bg-[#070A1C]'
                              )}
                            >
                              <TileIcon icon={item.icon} forceDark={forceDark} />
                              <div className={'flex flex-1 flex-col justify-between gap-1'}>
                                <div className={'flex items-center gap-2'}>
                                  <p className={'text-base font-semibold leading-tight'}>{item.name}</p>
                                  {external && <span className={'text-xs'}>{'↗'}</span>}
                                </div>
                                {item.description && (
                                  <p
                                    className={cl(
                                      'line-clamp-1 text-sm',
                                      forceDark ? 'text-neutral-500' : 'text-neutral-600 dark:text-neutral-500'
                                    )}
                                  >
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              {active && (
                                <span
                                  className={
                                    'absolute right-4 top-4 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary'
                                  }
                                >
                                  {'Active'}
                                </span>
                              )}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
