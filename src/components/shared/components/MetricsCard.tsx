import { Tooltip } from '@shared/components/Tooltip'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

export const METRIC_VALUE_CLASS = 'font-semibold text-[20px] leading-tight md:text-[22px]'
export const METRIC_FOOTNOTE_CLASS = 'text-xs text-text-secondary'

export type TMetricBlock = {
  key: string
  header: ReactElement
  value: ReactElement
  footnote?: ReactElement
  secondaryLabel?: ReactElement
}

export function MetricsCard({
  footnoteDisplay = 'inline',
  hideFootnotes = false,
  items,
  className,
  mobileLayout = 'stack'
}: {
  items: TMetricBlock[]
  footnoteDisplay?: 'inline' | 'tooltip'
  hideFootnotes?: boolean
  className?: string
  mobileLayout?: 'stack' | 'grid'
}): ReactElement {
  const isGrid = mobileLayout === 'grid'

  return (
    <div className={cl('rounded-lg bg-surface text-text-primary overflow-hidden', className)}>
      <div
        className={cl(
          'md:flex md:divide-y-0',
          isGrid
            ? 'grid grid-cols-2 gap-px bg-border md:grid-cols-none md:gap-0 md:bg-transparent'
            : 'divide-y divide-neutral-300'
        )}
      >
        {items.map((item, index): ReactElement => {
          const showFootnote = Boolean(item.footnote) && !hideFootnotes
          const useTooltip = showFootnote && footnoteDisplay === 'tooltip'
          const valueContent = useTooltip ? (
            <Tooltip
              className={'gap-0 h-auto'}
              openDelayMs={150}
              toggleOnClick
              tooltip={
                <div className={'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs'}>
                  {item.footnote}
                </div>
              }
            >
              <div className={'inline-flex'}>{item.value}</div>
            </Tooltip>
          ) : (
            item.value
          )

          return (
            <div
              key={item.key}
              className={cl(
                'flex flex-1 flex-col gap-1 px-5 py-3',
                isGrid ? 'bg-surface' : '',
                index < items.length - 1 ? 'md:border-r md:border-border' : ''
              )}
            >
              <div className={'flex items-center justify-between'}>{item.header}</div>
              <div className={'[&_b.yearn--table-data-section-item-value]:text-left font-semibold'}>{valueContent}</div>
              {showFootnote && footnoteDisplay === 'inline' ? <div>{item.footnote}</div> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MetricHeader({
  label,
  mobileLabel,
  tooltip
}: {
  label: string
  mobileLabel?: string
  tooltip?: string
}): ReactElement {
  const tooltipContent = (
    <div className={'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary'}>
      {tooltip}
    </div>
  )

  const underlineClass =
    'cursor-default underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:decoration-neutral-600'

  return (
    <p className={'flex items-center gap-1 text-xs font-normal uppercase tracking-wide text-text-secondary'}>
      {tooltip ? (
        <>
          <Tooltip
            align={'center'}
            openDelayMs={150}
            toggleOnClick
            className={'hidden md:inline'}
            tooltip={tooltipContent}
          >
            <span className={cl('hidden md:inline', underlineClass)}>{label}</span>
          </Tooltip>
          <Tooltip align={'center'} openDelayMs={150} toggleOnClick className={'md:hidden'} tooltip={tooltipContent}>
            <span className={cl('md:hidden', underlineClass)}>{mobileLabel ?? label}</span>
          </Tooltip>
        </>
      ) : (
        <span>{label}</span>
      )}
    </p>
  )
}
