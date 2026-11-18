import { cl } from '@shared/utils'
import { type ComponentPropsWithoutRef, forwardRef } from 'react'

export const compactActionButtonClassName =
  'relative flex h-11 shrink-0 cursor-pointer items-center rounded-lg focus-visible:outline-2 focus-visible:outline-primary'
export const compactActionButtonContentClassName =
  'inline-flex h-8 w-full min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-normal transition-colors duration-150 motion-reduce:transition-none'

export const CompactActionButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  function CompactActionButton({ children, className, type = 'button', ...props }, ref) {
    return (
      <button {...props} ref={ref} type={type} className={cl(compactActionButtonClassName, 'group', className)}>
        <span
          className={cl(
            compactActionButtonContentClassName,
            'border border-text-primary text-text-primary group-hover:bg-text-primary group-hover:text-surface'
          )}
        >
          {children}
        </span>
      </button>
    )
  }
)
