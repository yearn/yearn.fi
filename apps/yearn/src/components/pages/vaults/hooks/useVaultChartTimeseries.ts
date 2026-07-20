import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import type { TChartTimeseriesResponse } from '@pages/vaults/types/charts'
import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { toAddress } from '@shared/utils'
import { vaultChartTimeseriesSchema } from '@shared/utils/schemas/vaultChartsSchema'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isAddressEqual } from 'viem'

const TIMESERIES_BASE = `${KONG_REST_BASE}/timeseries`

type RestTimeseriesPoint = {
  time: number | string
  component?: string | null
  value: number | string | null
}

type TVaultChartsVariables = {
  chainId: number
  address: string
}

function buildTimeseriesUrl(segment: string, chainId: number, address: string, components?: string[]): string {
  const url = new URL(`${TIMESERIES_BASE}/${segment}/${chainId}/${address}`)
  components?.forEach((component) => {
    url.searchParams.append('components', component)
  })
  return url.toString()
}

async function fetchTimeseriesSegment(
  segment: string,
  chainId: number,
  address: string,
  components?: string[]
): Promise<RestTimeseriesPoint[]> {
  const url = buildTimeseriesUrl(segment, chainId, address, components)
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

function splitApyComponents(points: RestTimeseriesPoint[]): {
  weekly: RestTimeseriesPoint[]
  monthly: RestTimeseriesPoint[]
} {
  const hasComponent = points.some((point) => point.component)
  if (!hasComponent) {
    return { weekly: points, monthly: points }
  }
  return {
    weekly: points.filter((point) => point.component === 'weeklyNet'),
    monthly: points.filter((point) => point.component === 'monthlyNet')
  }
}

async function fetchVaultCharts({ chainId, address }: TVaultChartsVariables): Promise<TChartTimeseriesResponse> {
  try {
    const [apyCombined, tvl, pps] = await Promise.all([
      fetchTimeseriesSegment('apy-historical', chainId, address, ['weeklyNet', 'monthlyNet']),
      fetchTimeseriesSegment('tvl', chainId, address),
      fetchTimeseriesSegment('pps', chainId, address, ['humanized'])
    ])

    const { weekly: apyWeekly, monthly: apyMonthly } = splitApyComponents(apyCombined)

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
}

export function useVaultChartTimeseries({ chainId, address }: UseVaultChartsProps) {
  const resolvedAddress = address ? toAddress(address) : undefined
  const resolvedChartAddress = resolvedAddress
    ? isAddressEqual(resolvedAddress, YBOLD_VAULT_ADDRESS)
      ? YBOLD_STAKING_ADDRESS
      : resolvedAddress
    : undefined
  const normalizedAddress = resolvedChartAddress ? resolvedChartAddress.toLowerCase() : undefined

  const shouldFetch = Boolean(normalizedAddress) && Number.isInteger(chainId)

  return useQuery<TChartTimeseriesResponse>({
    queryKey: ['vault-charts', chainId, normalizedAddress],
    enabled: shouldFetch,
    queryFn: () =>
      fetchVaultCharts({
        chainId: Number(chainId),
        address: normalizedAddress as string
      }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData
  })
}
