import { cl } from '@lib/utils'
import type { ComponentProps, ComponentType, CSSProperties, ReactNode } from 'react'
import { createContext, forwardRef, useContext, useId, useMemo } from 'react'
import * as Recharts from 'recharts'

const THEMES = { light: '', dark: '.dark' } as const

export type ChartConfig = {
  [key: string]: {
    label?: ReactNode
    icon?: ComponentType
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> })
}

type ChartContextValue = {
  config: ChartConfig
}

const ChartContext = createContext<ChartContextValue | null>(null)

function useChart() {
  const context = useContext(ChartContext)
  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }
  return context
}

type ChartContainerProps = ComponentProps<'div'> & {
  config: ChartConfig
  children: ComponentProps<typeof Recharts.ResponsiveContainer>['children']
}

export const ChartContainer = forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ id, className, children, config, ...props }, ref) => {
    const uniqueId = useId()
    const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          data-chart={chartId}
          ref={ref}
          className={cl(
            'flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-neutral-500 [&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-neutral-200 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-neutral-200 [&_.recharts-dot[stroke="#fff"]]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-neutral-200 [&_.recharts-radial-bar-background-sector]:fill-neutral-100 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-neutral-100 [&_.recharts-reference-line_[stroke="#ccc"]]:stroke-neutral-200 [&_.recharts-sector[stroke="#fff"]]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none',
            className
          )}
          {...props}
        >
          <ChartStyle id={chartId} config={config} />
          <Recharts.ResponsiveContainer>{children}</Recharts.ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    )
  }
)
ChartContainer.displayName = 'ChartContainer'

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, entry]) => entry.theme || entry.color)
  if (!colorConfig.length) {
    return null
  }

  const styles = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const cssLines = colorConfig
        .map(([key, cfg]) => {
          const color = cfg.theme?.[theme as keyof typeof cfg.theme] || cfg.color
          return color ? `  --color-${key}: ${color};` : null
        })
        .filter(Boolean)
        .join('\n')
      return `${prefix} [data-chart=${id}] {\n${cssLines}\n}`
    })
    .join('\n')

  return <style>{styles}</style>
}

export const ChartTooltip = Recharts.Tooltip

type ChartTooltipContentProps = ComponentProps<typeof Recharts.Tooltip> &
  ComponentProps<'div'> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: 'line' | 'dot' | 'dashed'
    nameKey?: string
    labelKey?: string
  }

export const ChartTooltipContent = forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || 'value'}`
      const itemConfig = getPayloadConfig(config, item, key)
      const derivedLabel =
        !labelKey && typeof label === 'string'
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return <div className={cl('font-medium', labelClassName)}>{labelFormatter(derivedLabel, payload)}</div>
      }

      if (!derivedLabel) {
        return null
      }

      return <div className={cl('font-medium', labelClassName)}>{derivedLabel}</div>
    }, [config, hideLabel, label, labelClassName, labelFormatter, labelKey, payload])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== 'dot'

    return (
      <div
        ref={ref}
        className={cl(
          'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-xl',
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className={'grid gap-1.5'}>
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || 'value'}`
            const itemConfig = getPayloadConfig(config, item, key)
            const indicatorColor = color || item.payload.fill || item.color

            return (
              <div
                key={item.dataKey}
                className={cl(
                  'flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-neutral-500',
                  { 'items-center': indicator === 'dot' }
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cl('shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]', {
                            'h-2.5 w-2.5': indicator === 'dot',
                            'w-1': indicator === 'line',
                            'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
                            'my-0.5': nestLabel && indicator === 'dashed'
                          })}
                          style={
                            {
                              '--color-bg': indicatorColor,
                              '--color-border': indicatorColor
                            } as CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cl('flex flex-1 justify-between leading-none', {
                        'items-end': nestLabel,
                        'items-center': !nestLabel
                      })}
                    >
                      <div className={'grid gap-1.5'}>
                        {nestLabel ? tooltipLabel : null}
                        <span className={'text-neutral-500'}>{itemConfig?.label || item.name}</span>
                      </div>
                      {item.value !== undefined && item.value !== null ? (
                        <span className={'font-mono font-medium tabular-nums text-neutral-900'}>
                          {item.value.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = 'ChartTooltipContent'

function getPayloadConfig(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }

  const payloadPayload =
    'payload' in payload && typeof (payload as any).payload === 'object' && (payload as any).payload !== null
      ? ((payload as any).payload as Record<string, unknown>)
      : undefined

  let configLabelKey = key

  if (key in (payload as Record<string, unknown>) && typeof (payload as Record<string, unknown>)[key] === 'string') {
    configLabelKey = (payload as Record<string, string>)[key]
  } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key] === 'string') {
    configLabelKey = payloadPayload[key] as string
  }

  return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config]
}
