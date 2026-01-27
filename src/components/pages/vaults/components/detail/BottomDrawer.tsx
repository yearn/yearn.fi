import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { IconClose } from '@shared/icons/IconClose'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'
import { Fragment } from 'react'

type TBottomDrawerProps = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  headerActions?: ReactNode
}

export function BottomDrawer({ isOpen, onClose, children, title, headerActions }: TBottomDrawerProps): ReactElement {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-100'} onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter={'duration-300 ease-out'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'duration-200 ease-in'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-black/50'} aria-hidden={'true'} />
        </TransitionChild>

        <div className={'fixed inset-0 overflow-hidden'}>
          <div className={'flex min-h-full items-end justify-center'}>
            <TransitionChild
              as={Fragment}
              enter={'duration-300 ease-out'}
              enterFrom={'translate-y-full'}
              enterTo={'translate-y-0'}
              leave={'duration-200 ease-in'}
              leaveFrom={'translate-y-0'}
              leaveTo={'translate-y-full'}
            >
              <Dialog.Panel
                className={cl('w-full bg-surface rounded-t-3xl shadow-lg', 'h-[80dvh] max-h-[80dvh]', 'flex flex-col')}
              >
                <div className={'flex items-center justify-between p-4 pb-2'}>
                  {title ? <h2 className={'text-lg font-semibold text-text-primary'}>{title}</h2> : <div />}
                  <div className={'flex items-center gap-2'}>
                    {headerActions}
                    <button
                      type={'button'}
                      onClick={onClose}
                      className={cl(
                        'inline-flex size-10 items-center justify-center rounded-full',
                        'bg-surface-secondary text-text-secondary',
                        'active:scale-95 transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                      )}
                      aria-label={'Close drawer'}
                    >
                      <IconClose className={'size-5'} />
                    </button>
                  </div>
                </div>
                <div className={'flex-1 overflow-y-auto overflow-x-hidden relative'}>
                  <div className={'bg-surface-secondary h-full pb-[calc(2rem+env(safe-area-inset-bottom,0px))]'}>
                    {children}
                  </div>
                </div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
