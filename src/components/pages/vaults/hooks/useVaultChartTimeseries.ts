import type { TChartTimeseriesResponse } from '@pages/vaults/types/charts'
import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { toAddress } from '@shared/utils'
import { vaultChartTimeseriesSchema } from '@shared/utils/schemas/vaultChartsSchema'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 2000
const TIMESERIES_BASE = `${KONG_REST_BASE}/timeseries`

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

  const shouldFetch = Boolean(normalizedAddress) && Number.isInteger(chainId)

  return useQuery<TChartTimeseriesResponse>({
    queryKey: ['vault-charts', chainId, normalizedAddress, limitValue],
    enabled: shouldFetch,
    queryFn: () =>
      fetchVaultCharts({
        chainId: Number(chainId),
        address: normalizedAddress as string,
        limit: Number(limitValue)
      }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData
  })
}
