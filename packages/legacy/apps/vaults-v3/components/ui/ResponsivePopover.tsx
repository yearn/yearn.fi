import type { ReactElement, ReactNode } from 'react'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { useIsCoarsePointer } from '@vaults-v3/hooks/useIsCoarsePointer'
import { InfoButton } from './InfoButton'
import { cl } from '@lib/utils'

type Props = {
  trigger: ReactNode
  mobileTrigger?: ReactNode
  children: ReactNode
  mobileContent?: ReactNode
  panelClassName?: string
  contentClassName?: string
}

/**
 * Responsive popover:
 * - Desktop: wraps in a CSS-based tooltip container to preserve hover behavior
 * - Mobile: uses HeadlessUI Popover with a dedicated tap trigger
 */
export function ResponsivePopover({
  trigger,
  mobileTrigger,
  children,
  mobileContent,
  panelClassName,
  contentClassName
}: Props): ReactElement {
  const isCoarse = useIsCoarsePointer()

  if (isCoarse) {
    return (
      <Popover className={'relative inline-flex items-center'}>
        <PopoverButton
          as={'button'}
          data-no-nav
          onClick={(e) => {
            // Prevent parent row navigation while interacting with the popover trigger
            e.stopPropagation()
          }}
          className={'outline-none'}
        >
          {mobileTrigger ?? <InfoButton />}
        </PopoverButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <PopoverPanel
            static={false}
            className={cl(
              'absolute z-50 mt-2 right-0 max-w-[90vw] w-max',
              'rounded-xl border border-neutral-300 bg-neutral-200 p-4 text-neutral-900 shadow-lg',
              panelClassName
            )}
            onClick={(e) => {
              // Prevent parent row Link from navigating when interacting within the panel
              e.stopPropagation()
            }}
          >
            <div className={cl('text-sm', contentClassName)}>{mobileContent ?? children}</div>
          </PopoverPanel>
        </Transition>
      </Popover>
    )
  }

  // Desktop: preserve existing hover behavior via CSS classes
  return (
    <span className={'tooltip inline-flex items-center'}>
      {trigger}
      {/* The children here should be the tooltip body, rendered inside a positioned container by the caller */}
      {children}
    </span>
  )
}
