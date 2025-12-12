import { toAddress } from '@lib/utils'
import { vaultChartTimeseriesSchema } from '@lib/utils/schemas/vaultChartsSchema'
import type { TChartTimeseriesResponse } from '@nextgen/types/charts'
import useSWR from 'swr'

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 2000
const REST_BASE = (import.meta.env.VITE_KONG_REST_URL || 'https://kong.yearn.fi/api/rest').replace(/\/$/, '')
const TIMESERIES_BASE = `${REST_BASE}/timeseries`

type RestTimeseriesPoint = {
  time: number | string
  component?: string | null
  value: number | string | null
}

type TVaultChartsVariables = {
  chainId: number
  address: string
  limit: number
}

function buildTimeseriesUrl(
  segment: string,
  chainId: number,
  address: string,
  components?: string[],
  limit?: number
): string {
  const url = new URL(`${TIMESERIES_BASE}/${segment}/${chainId}/${address}`)
  components?.forEach((component) => {
    url.searchParams.append('components', component)
  })
  if (limit && Number.isFinite(limit)) {
    url.searchParams.set('limit', String(limit))
  }
  return url.toString()
}

async function fetchTimeseriesSegment(
  segment: string,
  chainId: number,
  address: string,
  components?: string[],
  limit?: number
): Promise<RestTimeseriesPoint[]> {
  const url = buildTimeseriesUrl(segment, chainId, address, components, limit)
  const response = await fetch(url)

  if (response.status === 404) {
    return []
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch timeseries for ${segment}: ${response.status}`)
  }

  const data = (await response.json()) as RestTimeseriesPoint[]
  return Array.isArray(data) ? data : []
}

function mapRestPoints(
  points: RestTimeseriesPoint[],
  chainId: number,
  address: string,
  label: string
): TChartTimeseriesResponse[keyof TChartTimeseriesResponse] {
  return points.map((point) => {
    const timeValue = Number(point.time)
    const numericValue = typeof point.value === 'string' ? Number(point.value) : point.value

    return {
      chainId,
      address,
      label,
      component: point.component ?? null,
      period: '1 day',
      time: Number.isFinite(timeValue) ? timeValue : point.time,
      value: Number.isFinite(numericValue ?? NaN) ? (numericValue as number) : null
    }
  })
}

async function fetchVaultCharts({ chainId, address, limit }: TVaultChartsVariables): Promise<TChartTimeseriesResponse> {
  try {
    const [apyWeekly, apyMonthly, tvl, pps] = await Promise.all([
      fetchTimeseriesSegment('apy-historical', chainId, address, ['weeklyNet'], limit),
      fetchTimeseriesSegment('apy-historical', chainId, address, ['monthlyNet'], limit),
      fetchTimeseriesSegment('tvl', chainId, address, undefined, limit),
      fetchTimeseriesSegment('pps', chainId, address, ['humanized'], limit)
    ])

    const payload = {
      apyWeekly: mapRestPoints(apyWeekly, chainId, address, 'apy-bwd-delta-pps'),
      apyMonthly: mapRestPoints(apyMonthly, chainId, address, 'apy-bwd-delta-pps'),
      tvl: mapRestPoints(tvl, chainId, address, 'tvl'),
      pps: mapRestPoints(pps, chainId, address, 'pps')
    }

    const parsed = vaultChartTimeseriesSchema.safeParse(payload)
    if (!parsed.success) {
      console.error('[useVaultChartTimeseries] Schema validation failed:', parsed.error)
      throw new Error('Invalid chart data received')
    }

    return parsed.data
  } catch (error) {
    console.error('[useVaultChartTimeseries] Unexpected error:', error)
    throw error instanceof Error ? error : new Error('Unable to fetch vault chart data')
  }
}

type UseVaultChartsProps = {
  chainId?: number
  address?: string
  limit?: number
}

export function useVaultChartTimeseries({ chainId, address, limit }: UseVaultChartsProps) {
  const normalizedAddress = address ? toAddress(address).toLowerCase() : undefined
  const limitValue = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)

  const shouldFetch = normalizedAddress && Number.isInteger(chainId)

  return useSWR<TChartTimeseriesResponse>(
    shouldFetch ? ['vault-charts', chainId, normalizedAddress, limitValue] : null,
    ([, chainIdValue, addressValue, limitParam]) =>
      fetchVaultCharts({
        chainId: Number(chainIdValue),
        address: String(addressValue),
        limit: Number(limitParam)
      }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000,
      keepPreviousData: true
    }
  )
}
