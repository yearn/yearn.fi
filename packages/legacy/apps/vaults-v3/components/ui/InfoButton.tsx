import type { ButtonHTMLAttributes, ReactElement } from 'react'
import { cl } from '@lib/utils'

export function InfoButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
  return (
    <button
      type={'button'}
      aria-label={'More info'}
      data-no-nav
      onClick={(e) => {
        // Prevent parent row navigation
        e.stopPropagation()
      }}
      className={cl(
        'md:hidden ml-2 inline-flex items-center justify-center h-8 w-8 rounded-md border border-neutral-200',
        'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
        className
      )}
      {...props}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={'text-current'}>
        <circle cx="8" cy="8" r="7" stroke="currentColor" fill="none" />
        <text x="8" y="11" textAnchor="middle" fontSize="10" className={'font-number fill-current'}>
          i
        </text>
      </svg>
    </button>
  )
}

