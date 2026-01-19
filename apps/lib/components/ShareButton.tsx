import { cl } from '@lib/utils'
import type { ReactElement } from 'react'

type TShareButtonProps = {
  onClick: () => void
  className?: string
  iconClassName?: string
  ariaLabel?: string
}

export function ShareButton({
  onClick,
  className,
  iconClassName,
  ariaLabel = 'Share'
}: TShareButtonProps): ReactElement {
  return (
    <button
      type={'button'}
      className={cl(
        'flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-3',
        'text-sm font-medium text-text-secondary',
        'transition-colors hover:border-border-hover hover:text-text-primary',
        className
      )}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <svg
        xmlns={'http://www.w3.org/2000/svg'}
        viewBox={'0 0 24 24'}
        fill={'none'}
        stroke={'currentColor'}
        strokeWidth={'2'}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
        className={cl('size-4', iconClassName)}
      >
        <path d={'M12 2v13'} />
        <path d={'m16 6-4-4-4 4'} />
        <path d={'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'} />
      </svg>
    </button>
  )
}
