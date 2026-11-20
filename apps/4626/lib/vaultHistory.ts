export type THistoryMetric = 'pps' | 'apy' | 'tvl'
export type THistoryPeriod = '7d' | '30d' | '1y' | 'all'
export type THistoryPoint = { time: number; value: number | null }

export const HISTORY_METRICS = {
  pps: { label: 'Share value', segment: 'pps', component: 'humanized' },
  apy: { label: '30-day APY', segment: 'apy-historical', component: 'monthlyNet' },
  tvl: { label: 'TVL', segment: 'tvl', component: 'tvl' }
} as const
export const HISTORY_PERIODS = [
  { id: '7d', label: '1W', days: 7 },
  { id: '30d', label: '1M', days: 30 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: Infinity }
] as const

export function parseVaultHistory(payload: unknown, metric: THistoryMetric): THistoryPoint[] {
  if (!Array.isArray(payload)) throw new Error('Invalid history response.')
  const points = payload.flatMap((row): THistoryPoint[] => {
    if (!row || typeof row !== 'object') return []
    if (row.component && row.component !== HISTORY_METRICS[metric].component) return []
    const time =
      typeof row.time === 'number' || (typeof row.time === 'string' && row.time.trim()) ? Number(row.time) : NaN
    if (!Number.isFinite(time) || time <= 0) return []
    const value =
      typeof row.value === 'number' || (typeof row.value === 'string' && row.value.trim()) ? Number(row.value) : NaN
    return [{ time, value: Number.isFinite(value) && (metric === 'apy' || value >= 0) ? value : null }]
  })
  if (payload.length && !points.length) throw new Error('Invalid history response.')
  return Array.from(new Map(points.map((point) => [point.time, point])).values()).sort((a, b) => a.time - b.time)
}

export async function fetchVaultHistory({
  chainId,
  address,
  metric,
  signal
}: {
  chainId: number
  address: string
  metric: THistoryMetric
  signal: AbortSignal
}): Promise<THistoryPoint[]> {
  const config = HISTORY_METRICS[metric]
  const url = new URL(`https://kong.yearn.fi/api/rest/timeseries/${config.segment}/${chainId}/${address.toLowerCase()}`)
  url.searchParams.set('components', config.component)
  const response = await fetch(url, { signal })
  if (response.status === 404) return []
  if (!response.ok) throw new Error('Unable to load vault history.')
  return parseVaultHistory(await response.json(), metric)
}

export function filterHistoryPeriod(points: THistoryPoint[], period: THistoryPeriod, now = Date.now() / 1000) {
  const days = HISTORY_PERIODS.find((option) => option.id === period)!.days
  return points.filter((point) => point.time >= now - days * 86400 && point.time <= now)
}

/** Preserve missing observations and gaps instead of interpolating unavailable history. */
export function historyGeometry(points: THistoryPoint[]) {
  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]))
  if (!values.length)
    return {
      segments: [] as { x: number; y: number; index: number }[][],
      coordinates: [] as { x: number; y: number; index: number }[],
      min: 0,
      max: 0
    }
  const lo = Math.min(...values),
    hi = Math.max(...values)
  const padding = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.002, 0.000001)
  const min = lo - padding,
    max = hi + padding
  const span = points.at(-1)!.time - points[0].time
  const coordinates = points.flatMap((point, index) =>
    point.value === null
      ? []
      : [
          {
            index,
            x: span ? 12 + ((point.time - points[0].time) / span) * 456 : 240,
            y: 180 - ((point.value - min) / (max - min)) * 160
          }
        ]
  )
  const segments = coordinates.reduce<{ x: number; y: number; index: number }[][]>((groups, point) => {
    const previous = groups.at(-1)?.at(-1)
    const connected =
      previous &&
      previous.index === point.index - 1 &&
      points[point.index].time - points[previous.index].time <= 2 * 86400
    if (connected) groups.at(-1)!.push(point)
    else groups.push([point])
    return groups
  }, [])
  return { segments, coordinates, min, max }
}

export function formatHistoryValue(value: number, metric: THistoryMetric, assetSymbol?: string) {
  if (metric === 'apy') return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
  if (metric === 'tvl')
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}${assetSymbol ? ` ${assetSymbol}` : ''}`
}
