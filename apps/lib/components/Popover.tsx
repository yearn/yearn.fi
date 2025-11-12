import { Popover as HeadlessPopover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { cl } from '@lib/utils'
import type { FC, ReactElement, ReactNode } from 'react'
import { Fragment } from 'react'

interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export const Popover: FC<PopoverProps> = ({ trigger, children, className, align = 'end', sideOffset = 8 }) => {
  return (
    <HeadlessPopover className="relative inline-flex">
      <PopoverButton as={Fragment}>{trigger}</PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel
          className={cl(
            'absolute z-50 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'end' && 'right-0',
            className
          )}
          style={{ top: `calc(100% + ${sideOffset}px)` }}
        >
          {children}
        </PopoverPanel>
      </Transition>
    </HeadlessPopover>
  )
}

export const PopoverContent: FC<{ children: ReactNode; className?: string }> = ({ children, className }) => {
  return <div className={cl('p-4', className)}>{children}</div>
}

export const PopoverTrigger = PopoverButton