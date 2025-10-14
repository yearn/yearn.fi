import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { IconClose } from '@lib/icons/IconClose'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Link from '/src/components/Link'

import { LogoYearn } from '../icons/LogoYearn'
import { APP_GROUPS, type TAppTile } from './YearnApps'

function TileIcon({ icon }: { icon?: ReactElement }): ReactElement {
  return (
    <div
      className={
        'flex size-12 items-center justify-center rounded-full bg-neutral-0 text-neutral-900 dark:bg-[#0F172A] dark:text-white'
      }
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

export function LogoModal(): ReactElement {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const previousPathname = useRef(location.pathname)

  const currentHost = useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.location.host.toLowerCase()
  }, [])

  const handleClose = useCallback((): void => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    if (previousPathname.current !== location.pathname && isOpen) {
      previousPathname.current = location.pathname
      handleClose()
      return
    }

    previousPathname.current = location.pathname
  }, [handleClose, isOpen, location.pathname])

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

      handleClose()
    },
    [handleClose]
  )

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
          icon={<LogoYearn className={'size-8! max-h-8! max-w-8!'} front={'text-white'} back={'text-primary'} />}
        />
      </button>

      <Transition show={isOpen} as={Fragment}>
        <Dialog as={'div'} className={'fixed inset-0 z-[9999] overflow-y-auto'} onClose={handleClose}>
          <div className={'flex min-h-full items-center justify-center sm:p-6'}>
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
                className={
                  'relative w-full max-w-6xl transform overflow-hidden rounded-3xl border border-neutral-100 bg-white p-6 text-neutral-900 shadow-2xl focus:outline-none dark:border-[#010A3B] dark:bg-neutral-0 dark:text-white sm:p-8'
                }
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
                      `flex size-6 items-center justify-center 
                      rounded-full border border-transparent 
                      text-neutral-200
                      bg-neutral-0/70 dark:bg-[#070A1C] 
                      hover:bg-primary/50
                      active:bg-primary/25 active:bg-primary/25

                      focus:outline-none focus-visible:ring-2 
                      focus-visible:ring-primary 
                      dark:text-neutral-700`
                    )}
                  >
                    <span className={'sr-only'}>{'Close'}</span>
                    <IconClose className={'size-4'} />
                  </button>
                </div>

                <div className={'flex flex-col gap-10'}>
                  {APP_GROUPS.map((group) => (
                    <section key={group.title} aria-label={group.title} className={'flex flex-col gap-2'}>
                      <h3
                        className={
                          'text-xs font-semibold uppercase tracking-[0.2em] text-neutral-200 dark:text-neutral-700'
                        }
                      >
                        {group.title}
                      </h3>
                      <div className={'grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4'}>
                        {group.items.map((item) => {
                          const active = isTileActive(item, location.pathname, currentHost)
                          const external = isExternalHref(item.href)

                          return (
                            <Link key={item.href} href={item.href} onClick={handleLinkClick}>
                              <div
                                data-active={active}
                                className={cl(
                                  'group relative flex flex-row items-center gap-3 rounded-xl border p-4 align-middle',
                                  'bg-neutral-0/70 hover:border-primary/70 hover:bg-primary/5 dark:bg-[#070A1C]',
                                  'border-neutral-200 dark:border-[#1C264F]',
                                  'data-[active=true]:border-primary! data-[active=true]:shadow-[0_0_0_2px_rgba(62,132,255,0.2)]',
                                  'active:border-primary! active:bg-neutral-0/70 active:dark:bg-[#070A1C]'
                                )}
                              >
                                <TileIcon icon={item.icon} />
                                <div className={'flex flex-1 flex-col justify-between gap-1'}>
                                  <div className={'flex items-center gap-2'}>
                                    <p className={'text-base font-semibold leading-tight'}>{item.name}</p>
                                    {external && <span className={'text-xs'}>{'↗'}</span>}
                                  </div>
                                  {item.description && (
                                    <p className={'line-clamp-1 text-sm text-neutral-200 dark:text-neutral-700'}>
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
                    </section>
                  ))}
                </div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
