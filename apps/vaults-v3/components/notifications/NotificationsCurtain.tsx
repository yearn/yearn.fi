import { useNotifications } from '@lib/contexts/useNotifications'
import { useYearn } from '@lib/contexts/useYearn'
import { IconCross } from '@lib/icons/IconCross'
import { cl } from '@lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
  type CSSProperties,
  type ReactElement,
  useEffect,
  useState,
} from 'react'
import { Drawer } from 'vaul'

import { Notification } from './Notification'

export function NotificationsCurtain(props: {
  setShouldOpenCurtain: (value: boolean) => void
  isOpen: boolean
  variant: 'v2' | 'v3'
}): ReactElement {
  const isDesktop = useIsMdUp()
  const drawerDirection = isDesktop ? 'right' : 'bottom'
  const { cachedEntries, setNotificationStatus, isLoading, error } =
    useNotifications()
  const { vaults, vaultsMigrations, vaultsRetired } = useYearn()
  const allVaults = { ...vaults, ...vaultsMigrations, ...vaultsRetired }

  const isEmpty = cachedEntries.length === 0

  const scrollAreaStyle: CSSProperties = {
    scrollbarColor: '#9E9E9E transparent',
    scrollbarWidth: 'thin',
    scrollbarGutter: 'stable',
    ...(drawerDirection === 'right' ? {} : { maxHeight: 'calc(90vh - 96px)' }),
  }

  /*************************************************************************************
   * Clear top bar notification status when drawer is triggered
   *******************************************************************/
  useEffect(() => {
    if (props.isOpen) {
      setNotificationStatus(null)
      // Block page scrolling when drawer is open
      document.body.style.overflow = 'hidden'
    } else {
      // Restore scrolling when drawer is closed
      document.body.style.overflow = ''
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = ''
    }
  }, [props.isOpen, setNotificationStatus])

  return (
    <Drawer.Root
      direction={drawerDirection}
      open={props.isOpen}
      onOpenChange={props.setShouldOpenCurtain}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className={
            'fixed inset-0 z-999998 bg-black/40 backdrop-blur-xs transition-all duration-300'
          }
        />
        <Drawer.Content
          className={cl(
            'fixed z-999999 outline-hidden',
            drawerDirection === 'right'
              ? 'inset-y-0 right-0 flex w-full md:w-[386px]'
              : 'inset-x-0 bottom-0 flex w-full justify-center'
          )}
        >
          <div
            className={cl(
              'flex w-full grow flex-col shadow-2xl',
              drawerDirection === 'right'
                ? 'py-5 pl-5 md:my-2 md:mr-2'
                : 'rounded-t-3xl px-5 pb-6 pt-5 max-h-[90vh]',
              props.variant === 'v3'
                ? drawerDirection === 'right'
                  ? 'bg-neutral-100 md:rounded-3xl'
                  : 'bg-neutral-100'
                : 'bg-neutral-0'
            )}
          >
            <div className={'h-full'}>
              <div className={'mb-4 flex items-center justify-between pr-4'}>
                <Drawer.Title className={'font-bold text-neutral-900'}>
                  {'Notifications'}
                </Drawer.Title>
                <Drawer.Close
                  className={
                    'rounded-full p-1 text-neutral-900 transition-colors hover:text-neutral-600'
                  }
                >
                  <IconCross className={'size-4'} />
                </Drawer.Close>
              </div>
              <div
                className={cl(
                  'overflow-y-auto overflow-x-hidden pt-2',
                  drawerDirection === 'right' ? 'h-[94.5%]' : 'max-h-full'
                )}
                style={scrollAreaStyle}
              >
                {isLoading ? (
                  <div className={'flex h-full items-center justify-center'}>
                    <div className={'flex flex-col items-center gap-2'}>
                      <div
                        className={
                          'size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900'
                        }
                      />
                      <p className={'text-sm text-neutral-600'}>
                        {'Loading notifications...'}
                      </p>
                    </div>
                  </div>
                ) : error ? (
                  <div className={'mx-auto mt-40 text-center'}>
                    <p className={'text-red-600 font-medium'}>
                      {'Error loading notifications'}
                    </p>
                    <p className={'mt-2 text-sm text-neutral-600'}>{error}</p>
                  </div>
                ) : isEmpty ? (
                  <p
                    className={
                      'mx-auto my-20 sm:mt-40 text-center text-neutral-800'
                    }
                  >
                    {'No transactions to show.'}
                  </p>
                ) : (
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
                    className={'flex h-full flex-col pr-2'}
                  >
                    <AnimatePresence mode={'popLayout'}>
                      {cachedEntries.toReversed().map((entry) => (
                        <Notification
                          key={`notification-${entry.id}`}
                          fromVault={
                            entry.fromAddress
                              ? allVaults[entry.fromAddress]
                              : undefined
                          }
                          toVault={
                            entry.toAddress
                              ? allVaults[entry.toAddress]
                              : undefined
                          }
                          notification={entry}
                          variant={props.variant}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function useIsMdUp(): boolean {
  const [isMdUp, setIsMdUp] = useState(true)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handler = (): void => setIsMdUp(mediaQuery.matches)

    handler()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler)
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handler)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handler)
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handler)
      }
    }
  }, [])

  return isMdUp
}
