import { Renderable } from '@shared/components/Renderable'
import { Tooltip } from '@shared/components/Tooltip'
import { cl } from '@shared/utils'
import type { MouseEvent, ReactElement, ReactNode } from 'react'

export type TApyTooltipMode = 'none' | 'tooltip' | 'tooltip+modal'

export type TApyTooltipConfig = {
  mode: TApyTooltipMode
  content?: ReactElement | string | null
  className?: string
  openDelayMs?: number
  align?: 'center' | 'start' | 'left' | 'right'
  side?: 'top' | 'bottom' | 'left' | 'right'
  zIndex?: number
}

export type TApyDisplayConfig = {
  value: ReactNode
  shouldRender: boolean
  fallbackLabel: string
  tooltip?: TApyTooltipConfig
  isInteractive?: boolean
  showUnderline?: boolean
  showAsterisk?: boolean
  fixedRateIndicator?: ReactNode
  subline?: ReactNode
  valueClassName?: string
}

type TApyDisplayProps = {
  config: TApyDisplayConfig
  className?: string
  valueClassName?: string
  onValueClick?: (e: MouseEvent) => void
  onHoverChange?: (isHovering: boolean) => void
}

const UNDERLINE_CLASS =
  'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 ' +
  'transition-opacity hover:decoration-neutral-600'

export function ApyDisplay({
  config,
  className,
  valueClassName,
  onValueClick,
  onHoverChange
}: TApyDisplayProps): ReactElement {
  const tooltip = config.tooltip
  const tooltipContent = tooltip?.content ?? null
  const hasTooltip = Boolean(tooltip && tooltip.mode !== 'none' && tooltipContent != null)
  const shouldUnderline = config.showUnderline ?? hasTooltip
  const valueInteractiveClass = config.isInteractive ? 'cursor-pointer' : undefined
  const underlineClass = shouldUnderline ? UNDERLINE_CLASS : undefined
  const interactiveHandlers =
    config.isInteractive && onHoverChange
      ? {
          onMouseEnter: (): void => onHoverChange(true),
          onMouseLeave: (): void => onHoverChange(false)
        }
      : undefined

  const valueNode = (
    <b
      className={cl('yearn--table-data-section-item-value', valueClassName, config.valueClassName)}
      onClick={onValueClick}
      {...interactiveHandlers}
    >
      <Renderable shouldRender={config.shouldRender} fallback={config.fallbackLabel}>
        <span className={'inline-flex items-center gap-2'}>
          {config.fixedRateIndicator}
          <span className={cl('relative inline-flex items-center gap-1', valueInteractiveClass, underlineClass)}>
            {config.value}
            {config.showAsterisk ? (
              <span
                aria-hidden={true}
                className={'pointer-events-none absolute left-full -top-px ml-px text-sm text-text-secondary'}
              >
                {'*'}
              </span>
            ) : null}
          </span>
        </span>
      </Renderable>
    </b>
  )

  const valueWithTooltip =
    hasTooltip && tooltip && tooltipContent != null ? (
      <Tooltip
        className={tooltip.className}
        openDelayMs={tooltip.openDelayMs}
        align={tooltip.align}
        side={tooltip.side}
        zIndex={tooltip.zIndex}
        tooltip={tooltipContent}
      >
        {valueNode}
      </Tooltip>
    ) : (
      valueNode
    )

  return (
    <div className={cl('flex flex-col items-end md:text-right', className)}>
      {valueWithTooltip}
      {config.subline}
    </div>
  )
}
