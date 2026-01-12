import { cl } from '@lib/utils'
import type { ReactElement, ReactNode } from 'react'

type TVaultsListChipProps = {
  label: string
  icon?: ReactNode
  isActive?: boolean
  isCollapsed?: boolean
  onClick?: () => void
  ariaLabel?: string
  disabled?: boolean
}

export function VaultsListChip({
  label,
  icon,
  isActive = false,
  isCollapsed = false,
  onClick,
  ariaLabel,
  disabled = false
}: TVaultsListChipProps): ReactElement {
  const isInteractive = Boolean(onClick) && !disabled
  const shouldCollapse = isCollapsed && Boolean(icon)

  return (
    <button
      type={'button'}
      className={cl(
        'inline-flex items-center rounded-lg border border-border px-1 py-0.5 text-xs font-medium transition-colors',
        'bg-surface-secondary text-text-primary/70',
        'data-[active=true]:bg-surface-tertiary/80 data-[active=true]:text-text-primary',
        isInteractive ? 'cursor-pointer hover:bg-surface-tertiary/80 hover:text-text-primary' : 'cursor-default',
        shouldCollapse ? 'gap-0' : 'gap-1'
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
      <span className={shouldCollapse ? 'sr-only' : ''}>{label}</span>
    </button>
  )
}
