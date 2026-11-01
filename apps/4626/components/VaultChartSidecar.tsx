'use client'

import {
  fetchVaultHistory,
  filterHistoryPeriod,
  formatHistoryValue,
  HISTORY_METRICS,
  HISTORY_PERIODS,
  historyGeometry,
  type THistoryMetric,
  type THistoryPeriod,
  type THistoryPoint
} from '@erc4626/lib/vaultHistory'
import { useQuery } from '@tanstack/react-query'
import type { VaultWidgetVault } from '@yearn/vault-widget/types'
import { useId, useMemo, useState } from 'react'

const dateLabel = (time: number, full = false) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(full ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC'
  }).format(time * 1000)

function HistoryView({
  points,
  metric,
  assetSymbol
}: {
  points: THistoryPoint[]
  metric: THistoryMetric
  assetSymbol?: string
}) {
  const [inspection, setInspection] = useState<number | null>(null)
  const id = useId().replaceAll(':', '')
  const { segments, coordinates } = useMemo(() => historyGeometry(points), [points])
  const latest = coordinates.at(-1)
  const active = coordinates.find((point) => point.index === inspection) ?? latest
  if (!active || !latest)
    return (
      <div
        role="status"
        className="flex min-h-72 items-center justify-center px-4 text-center text-sm text-text-secondary"
      >
        No observations available for this period. Try a longer range.
      </div>
    )
  const point = points[active.index]
  const first = points[coordinates[0].index].value!
  const last = points[latest.index].value!
  const change = metric === 'apy' ? (last - first) * 100 : first !== 0 ? (last / first - 1) * 100 : undefined
  return (
    <>
      <div className="mb-3 mt-4 min-h-20">
        <p className="text-xs text-text-secondary">
          {HISTORY_METRICS[metric].label}
          {metric === 'pps' ? ' · per vault share' : ''}
        </p>
        <p className="mt-1 break-words text-3xl tabular-nums tracking-tight" data-chart-value>
          {formatHistoryValue(point.value!, metric, assetSymbol)}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {inspection !== null
            ? dateLabel(point.time, true)
            : change === undefined
              ? 'Change unavailable'
              : `${change > 0 ? '+' : ''}${change.toFixed(2)}${metric === 'apy' ? ' percentage points' : '%'} over period`}
        </p>
      </div>
      <div
        role="slider"
        aria-label={`Explore ${HISTORY_METRICS[metric].label.toLowerCase()} history`}
        aria-valuemin={0}
        aria-valuemax={coordinates.length - 1}
        aria-valuenow={coordinates.indexOf(active)}
        aria-valuetext={`${dateLabel(point.time, true)}, ${formatHistoryValue(point.value!, metric, assetSymbol)}`}
        tabIndex={0}
        className="relative min-h-44 w-full flex-1 touch-pan-y rounded-lg"
        onFocus={() => setInspection(latest.index)}
        onBlur={() => setInspection(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = ((event.clientX - rect.left) / rect.width) * 480
          const nearest = coordinates.reduce((best, item) =>
            Math.abs(item.x - x) < Math.abs(best.x - x) ? item : best
          )
          setInspection(nearest.index)
        }}
        onPointerLeave={(event) => {
          if (!event.currentTarget.matches(':focus')) setInspection(null)
        }}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const current = coordinates.indexOf(active)
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? coordinates.length - 1
                : Math.max(0, Math.min(coordinates.length - 1, current + (event.key === 'ArrowLeft' ? -1 : 1)))
          setInspection(coordinates[next].index)
        }}
      >
        <svg
          viewBox="0 0 480 200"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
          data-vault-chart
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 100, 175].map((y) => (
            <line
              key={y}
              x1="12"
              y1={y}
              x2="468"
              y2={y}
              stroke="var(--color-border)"
              strokeDasharray="2 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {segments.map((segment) => {
            const line = segment.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
            return (
              <g key={segment[0].index}>
                {segment.length === 1 && (
                  <circle cx={segment[0].x} cy={segment[0].y} r="2" fill="var(--color-primary)" />
                )}
                <path d={`${line} L${segment.at(-1)!.x},200 L${segment[0].x},200 Z`} fill={`url(#${id})`} />
                <path
                  d={line}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              </g>
            )
          })}
          {inspection !== null && (
            <line
              x1={active.x}
              y1="8"
              x2={active.x}
              y2="194"
              stroke="var(--color-border)"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <circle
            cx={active.x}
            cy={active.y}
            r="4"
            fill="var(--color-primary)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-text-secondary">
        <span>{dateLabel(points[0].time)}</span>
        <span>{dateLabel(points.at(-1)!.time)}</span>
      </div>
    </>
  )
}

export function VaultChartSidecar({
  enabled,
  onClose,
  vault
}: {
  enabled: boolean
  onClose: () => void
  vault?: VaultWidgetVault
}) {
  const [metric, setMetric] = useState<THistoryMetric>('pps')
  const [period, setPeriod] = useState<THistoryPeriod>('30d')
  const history = useQuery({
    queryKey: ['widget-vault-history', vault?.chainId, vault?.address.toLowerCase(), metric],
    enabled: enabled && !!vault,
    staleTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => fetchVaultHistory({ chainId: vault!.chainId, address: vault!.address, metric, signal })
  })
  const points = filterHistoryPeriod(history.data ?? [], period)
  return (
    <section
      aria-label="Vault history"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      className="flex h-full max-h-[calc(100dvh-13rem)] flex-col overflow-y-auto rounded-2xl border border-border bg-surface p-4 text-text-primary sm:p-5 md:max-h-none md:min-w-72"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <fieldset
          aria-label="Chart metric"
          data-selector-toggle
          className="flex min-w-0 flex-1 gap-1 rounded-lg border border-border bg-surface-secondary p-1"
        >
          {(Object.keys(HISTORY_METRICS) as THistoryMetric[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={metric === option}
              onClick={() => setMetric(option)}
              className={`flex-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs transition-colors ${metric === option ? 'border-border bg-surface font-semibold text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              {HISTORY_METRICS[option].label}
            </button>
          ))}
        </fieldset>
        <a
          href={vault ? `https://powerglove.yearn.fi/vaults/${vault.chainId}/${vault.address}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open vault in Powerglove"
          title="Open vault in Powerglove"
          aria-disabled={!vault}
          tabIndex={vault ? undefined : -1}
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary/30 ${vault ? '' : 'pointer-events-none opacity-40'}`}
        >
          <span className="sr-only">Open vault in Powerglove</span>
          <svg
            aria-hidden="true"
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6m0-6L10 14M11 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" />
          </svg>
        </a>
      </div>
      {!vault ? (
        <div role="status" className="flex min-h-72 items-center justify-center text-sm text-text-secondary">
          Select a vault to view its history.
        </div>
      ) : history.isPending ? (
        <div role="status" className="flex min-h-72 items-center justify-center text-sm text-text-secondary">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" />
          Loading vault history…
        </div>
      ) : history.isError ? (
        <div
          role="alert"
          className="flex min-h-72 flex-col items-center justify-center gap-3 text-center text-sm text-text-secondary"
        >
          <p>Vault history could not be loaded.</p>
          <button
            type="button"
            onClick={() => void history.refetch()}
            className="rounded-lg border border-border px-4 py-2 text-text-primary hover:bg-surface-secondary/30"
          >
            Retry history
          </button>
        </div>
      ) : history.data.length === 0 ? (
        <div
          role="status"
          className="flex min-h-72 items-center justify-center px-4 text-center text-sm text-text-secondary"
        >
          No indexed history is available for this vault yet.
        </div>
      ) : (
        <HistoryView
          key={`${vault.chainId}:${vault.address}:${metric}:${period}`}
          points={points}
          metric={metric}
          assetSymbol={vault.asset.symbol}
        />
      )}
      <fieldset aria-label="Chart period" className="mt-auto flex shrink-0 gap-1 pt-4">
        {HISTORY_PERIODS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={period === option.id}
            onClick={() => setPeriod(option.id)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${period === option.id ? 'bg-surface-secondary font-semibold text-text-primary' : 'text-text-secondary hover:bg-surface-secondary/30'}`}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
    </section>
  )
}
