import { TOOLTIP_DELAY_MS } from '@pages/vaults/utils/vaultTagCopy'
import { Tooltip } from '@shared/components/Tooltip'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'

type TVaultsListChipProps = {
  label: string
  icon?: ReactNode
  isActive?: boolean
  isCollapsed?: boolean
  showCollapsedTooltip?: boolean
  tooltipDescription?: string
  tooltip?: string | ReactElement
  tooltipDelayMs?: number
  onClick?: () => void
  onHoverChange?: (isHovering: boolean) => void
  ariaLabel?: string
  disabled?: boolean
}

export function VaultsListChip({
  label,
  icon,
  isActive = false,
  isCollapsed = false,
  showCollapsedTooltip = false,
  tooltipDescription,
  tooltip,
  tooltipDelayMs,
  onClick,
  onHoverChange,
  ariaLabel,
  disabled = false
}: TVaultsListChipProps): ReactElement {
  const isInteractive = Boolean(onClick) && !disabled
  const shouldCollapse = isCollapsed && Boolean(icon)
  const iconNode = icon ? (
    <span className={'flex size-4 items-center justify-center text-text-secondary'}>{icon}</span>
  ) : null

  const chip = (
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
      onMouseEnter={isInteractive && onHoverChange ? (): void => onHoverChange(true) : undefined}
      onMouseLeave={isInteractive && onHoverChange ? (): void => onHoverChange(false) : undefined}
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
      {iconNode}
      <span className={shouldCollapse ? 'sr-only' : ''}>{label}</span>
    </button>
  )

  const tooltipContent =
    tooltip ||
    (tooltipDescription ? (
      <div
        className={
          'max-w-[220px] rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-text-primary shadow-md'
        }
      >
        <div className={'flex items-center gap-1 font-semibold'}>
          {iconNode}
          <span>{label}</span>
        </div>
        <p className={'text-text-secondary'}>{tooltipDescription}</p>
      </div>
    ) : shouldCollapse && showCollapsedTooltip ? (
      <div
        className={
          'flex items-center gap-1 rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs font-medium text-text-primary shadow-md'
        }
      >
        {iconNode}
        <span>{label}</span>
      </div>
    ) : null)

  if (!tooltipContent) {
    return chip
  }

  return (
    <Tooltip
      className={'h-auto'}
      openDelayMs={tooltipDelayMs ?? (tooltipDescription || tooltip ? TOOLTIP_DELAY_MS : 0)}
      tooltip={tooltipContent}
      align={'start'}
    >
      {chip}
    </Tooltip>
  )
}
