import { cl } from '@lib/utils'
import type { ReactElement, ReactNode } from 'react'

type TVaultsListChipProps = {
  label: string
  icon?: ReactNode
  isActive?: boolean
  onClick?: () => void
  ariaLabel?: string
  disabled?: boolean
}

export function VaultsListChip({
  label,
  icon,
  isActive = false,
  onClick,
  ariaLabel,
  disabled = false
}: TVaultsListChipProps): ReactElement {
  const isInteractive = Boolean(onClick) && !disabled

  return (
    <button
      type={'button'}
      className={cl(
        'inline-flex items-center gap-1 rounded-lg border border-border px-1 py-0.5 text-xs font-medium transition-colors',
        'bg-surface-secondary text-text-primary/70',
        'data-[active=true]:bg-surface-tertiary/80 data-[active=true]:text-text-primary data-[active=true]:outline-solid data-[active=true]:outline-1 data-[active=true]:outline-primary',
        isInteractive ? 'cursor-pointer hover:bg-surface-tertiary/80 hover:text-text-primary' : 'cursor-default'
      )}
      data-active={isActive}
      aria-pressed={isInteractive ? isActive : undefined}
      aria-label={ariaLabel || label}
      onClick={
        isInteractive
          ? (event): void => {
              event.stopPropagation()
              onClick?.()
            }
          : undefined
      }
      disabled={disabled}
    >
      {icon ? <span className={'flex size-4 items-center justify-center text-text-secondary'}>{icon}</span> : null}
      <span>{label}</span>
    </button>
  )
}
