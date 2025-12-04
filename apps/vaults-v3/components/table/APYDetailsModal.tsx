import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { IconClose } from '@lib/icons/IconClose'
import { cl } from '@lib/utils'
import type { ReactElement, ReactNode } from 'react'
import { Fragment } from 'react'

type TAPYDetailsModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function APYDetailsModal({ isOpen, onClose, title, children }: TAPYDetailsModalProps): ReactElement {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-[60]'} onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter={'duration-200 ease-out'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'duration-150 ease-in'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div
            className={'fixed inset-0 bg-black/40'}
            onClick={(event): void => {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            }}
          />
        </TransitionChild>

        <div
          className={'fixed inset-0 overflow-y-auto'}
          onClick={(event): void => {
            event.stopPropagation()
          }}
        >
          <div className={'flex min-h-full items-center justify-center p-4'}>
            <TransitionChild
              as={Fragment}
              enter={'duration-200 ease-out'}
              enterFrom={'opacity-0 scale-95'}
              enterTo={'opacity-100 scale-100'}
              leave={'duration-150 ease-in'}
              leaveFrom={'opacity-100 scale-100'}
              leaveTo={'opacity-0 scale-95'}
            >
              <Dialog.Panel
                className={
                  'w-full max-w-xl rounded-3xl border border-neutral-200 bg-neutral-0 p-6 text-neutral-900 shadow-lg'
                }
              >
                <div className={'flex items-start justify-between gap-4'}>
                  <Dialog.Title className={'text-lg font-semibold text-neutral-900'}>{title}</Dialog.Title>
                  <button
                    type={'button'}
                    onClick={onClose}
                    className={cl(
                      'inline-flex size-8 items-center justify-center rounded-full border border-transparent text-neutral-500',
                      'hover:border-neutral-300 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-300'
                    )}
                    aria-label={'Close APY details'}
                  >
                    <IconClose className={'size-4'} />
                  </button>
                </div>
                <div className={'mt-4 text-sm leading-relaxed text-neutral-700'}>{children}</div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
