import { IconCross } from '@lib/icons/IconCross'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'

type TSearchChipProps = {
  label: string
  onRemove: () => void
  className?: string
}

export function SearchChip({ label, onRemove, className }: TSearchChipProps): ReactElement {
  return (
    <span
      className={cl(
        'group inline-flex items-center gap-2 rounded-full bg-neutral-200 px-3 py-1 text-sm text-neutral-900 transition-colors hover:bg-neutral-300',
        className
      )}
    >
      <span className={'truncate'}>{label}</span>
      <button
        type={'button'}
        onClick={onRemove}
        className={
          'flex size-4 items-center justify-center rounded-full bg-neutral-400/40 text-neutral-800 opacity-0 transition-all group-hover:opacity-100 hover:bg-neutral-500/70'
        }
        aria-label={`Remove ${label}`}
      >
        <IconCross className={'size-3'} />
      </button>
    </span>
  )
}
