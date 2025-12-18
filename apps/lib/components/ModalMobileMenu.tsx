'use client'
import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { IconClose } from '@lib/icons/IconClose'
import type React from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { Chain } from 'viem'
import Link from '/src/components/Link'
import type { TMenu } from './Header'

const menu: TMenu[] = [
  { path: 'https://docs.yearn.fi/', label: 'Docs', target: '_blank' },
  { path: 'https://discord.gg/yearn', label: 'Support', target: '_blank' },
  { path: 'https://blog.yearn.fi/', label: 'Blog', target: '_blank' },
  {
    path: 'https://gov.yearn.fi/',
    label: 'Discourse',
    target: '_blank'
  },
  { path: 'https://github.com/yearn', label: 'Github', target: '_blank' },
  { path: 'https://x.com/yearnfi', label: 'X (Twitter)', target: '_blank' }
]

export function FooterNav({ onClose }: { onClose?: () => void }): ReactElement {
  return (
    <div
      className={
        'flex w-full flex-col gap-6 rounded-3xl p-0 md:flex-row md:space-x-14 md:space-y-0 md:bg-[#222222]/50 md:p-3'
      }
    >
      <div className={'flex w-full flex-col gap-8 justify-center rounded-xl p-6 md:flex-row md:bg-black/30'}>
        {menu.map((link) => (
          <Link
            className={'flex items-center gap-2 text-white transition-colors hover:text-primary'}
            key={link.path}
            target={link.target}
            href={link.path}
            onClick={() => {
              // Close modal for internal navigation (not external links)
              if (!link.target && onClose) {
                onClose()
              }
            }}
          >
            <span className={'text-[20px]'}>{link.label}</span>
            <span className={'size-6'}>{'↗'}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

type TModalMobileMenu = {
  isOpen: boolean
  shouldUseWallets: boolean
  shouldUseNetworks: boolean
  onClose: () => void
  children: ReactNode
  supportedNetworks: Chain[]
}

export type TModal = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
} & React.ComponentPropsWithoutRef<'div'>

export function ModalMobileMenu(props: TModalMobileMenu): ReactElement {
  const { isOpen, onClose } = props

  return (
    <Transition show={isOpen} as={'div'}>
      <Dialog as={'div'} className={'fixed inset-0 overflow-y-auto'} style={{ zIndex: 88 }} onClose={onClose}>
        <div className={'relative flex h-screen w-screen items-stretch justify-start px-0 pb-0 text-center'}>
          <TransitionChild
            as={'div'}
            enter={'ease-out duration-300'}
            enterFrom={'opacity-0'}
            enterTo={'opacity-100'}
            leave={'ease-in duration-200'}
            leaveFrom={'opacity-100'}
            leaveTo={'opacity-0'}
          >
            <div className={'yearn--modal-overlay'} />
          </TransitionChild>

          <span className={'hidden'} aria-hidden={'true'}>
            &#8203;
          </span>
          <TransitionChild
            as={'div'}
            enter={'ease-out duration-200'}
            enterFrom={'opacity-0 translate-y-full'}
            enterTo={'opacity-100 translate-y-0'}
            leave={'ease-in duration-200'}
            leaveFrom={'opacity-100 translate-y-0'}
            leaveTo={'opacity-0 translate-y-full'}
            style={{ width: '100%' }}
          >
            <div className={'w-full h-full max-w-full flex flex-col bg-neutral-0 overflow-hidden relative z-50'}>
              <div className={'flex items-center justify-end border-b border-gray-600 p-4 pt-6'}>
                <button onClick={onClose}>
                  <IconClose />
                </button>
              </div>
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(12, 12, 12, 0.8) 0%, rgba(26, 26, 26, 0.8) 100%)'
                }}
                className={'flex flex-1 w-full flex-col justify-end px-8 pb-20 h-full'}
              >
                <FooterNav onClose={onClose} />
              </div>
            </div>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
