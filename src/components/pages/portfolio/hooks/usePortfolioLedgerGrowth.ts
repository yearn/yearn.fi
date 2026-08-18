import {
  portfolioLedgerGrowthResponseSchema,
  type TPortfolioLedgerGrowthResponse,
  type TPortfolioLedgerGrowthVault
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import type { TSortDirection } from '@shared/types'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'

const PORTFOLIO_LEDGER_GROWTH_CACHE_DURATION = 60 * 60 * 1000

type TPortfolioLedgerGrowthVersion = TPortfolioLedgerGrowthResponse['version']

export type TPortfolioLedgerGrowthDisplay = {
  amount: number | null
  percent: number | null
  annualizedPercent: number | null
  symbol: string | null
  decimals: number
}

export function buildPortfolioLedgerGrowthEndpoint(args: {
  address: string
  snapshotId: string
  version?: TPortfolioLedgerGrowthVersion
}): string {
  const params = new URLSearchParams({
    address: args.address,
    snapshotId: args.snapshotId,
    version: args.version ?? 'all'
  })
  return `/api/holdings/ledger/growth?${params}`
}

export function getPortfolioLedgerGrowthCacheKey(endpoint: string, snapshotId: string) {
  return ['fetch', endpoint, 'portfolio-ledger-growth', snapshotId] as const
}

export function getPortfolioLedgerGrowthVaultKey(vault: Pick<TPortfolioLedgerGrowthVault, 'chainId' | 'vaultAddress'>) {
  return `${vault.chainId}_${toAddress(vault.vaultAddress)}`
}

export function mapPortfolioLedgerGrowthVaults(
  vaults: readonly TPortfolioLedgerGrowthVault[]
): ReadonlyMap<string, TPortfolioLedgerGrowthVault> {
  return new Map(vaults.map((vault) => [getPortfolioLedgerGrowthVaultKey(vault), vault] as const))
}

function getPortfolioLedgerGrowthSortValue(vault: TPortfolioLedgerGrowthVault | undefined): number | null {
  return vault?.status === 'ok' && vault.growthPct !== null && Number.isFinite(vault.growthPct) ? vault.growthPct : null
}

export function comparePortfolioLedgerGrowthVaults(
  left: TPortfolioLedgerGrowthVault | undefined,
  right: TPortfolioLedgerGrowthVault | undefined,
  sortDirection: TSortDirection
): number {
  const leftValue = getPortfolioLedgerGrowthSortValue(left)
  const rightValue = getPortfolioLedgerGrowthSortValue(right)

  if (leftValue === null) {
    return rightValue === null ? 0 : 1
  }
  if (rightValue === null) {
    return -1
  }
  if (sortDirection === 'asc') {
    return leftValue - rightValue
  }
  if (sortDirection === 'desc') {
    return rightValue - leftValue
  }
  return 0
}

export function toPortfolioLedgerGrowthDisplay(
  vault: TPortfolioLedgerGrowthVault | undefined
): TPortfolioLedgerGrowthDisplay | null {
  if (vault?.status !== 'ok' || !Number.isFinite(vault.growthUnderlying) || !vault.metadata.symbol) {
    return null
  }

  return {
    amount: vault.growthUnderlying,
    percent: vault.growthPct !== null && Number.isFinite(vault.growthPct) ? vault.growthPct : null,
    annualizedPercent:
      vault.annualizedProtocolReturnPct !== null && Number.isFinite(vault.annualizedProtocolReturnPct)
        ? vault.annualizedProtocolReturnPct
        : null,
    symbol: vault.metadata.symbol,
    decimals: vault.metadata.assetDecimals
  }
}

export function usePortfolioLedgerGrowth(
  snapshotId: string | null = null,
  enabled = true,
  version: TPortfolioLedgerGrowthVersion = 'all'
) {
  const { address } = useWeb3()
  const endpoint = useMemo(
    () =>
      address && snapshotId && enabled ? buildPortfolioLedgerGrowthEndpoint({ address, snapshotId, version }) : null,
    [address, enabled, snapshotId, version]
  )
  const cacheKey = useMemo(
    () => (endpoint && snapshotId ? getPortfolioLedgerGrowthCacheKey(endpoint, snapshotId) : undefined),
    [endpoint, snapshotId]
  )
  const { data, isLoading, isFetching, error } = useFetch<TPortfolioLedgerGrowthResponse>({
    endpoint,
    schema: portfolioLedgerGrowthResponseSchema,
    config: {
      cacheKey,
      cacheDuration: PORTFOLIO_LEDGER_GROWTH_CACHE_DURATION,
      gcTime: PORTFOLIO_LEDGER_GROWTH_CACHE_DURATION,
      keepPreviousData: false,
      maxRetries: 0,
      timeout: 5 * 60 * 1000
    }
  })
  const vaults = useMemo(() => data?.vaults ?? [], [data?.vaults])
  const vaultsByKey = useMemo(() => mapPortfolioLedgerGrowthVaults(vaults), [vaults])
  const isLoadingState = !data && (isLoading || isFetching)

  return {
    data: data ?? null,
    summary: data?.summary ?? null,
    vaults,
    vaultsByKey,
    isLoading: isLoadingState,
    error,
    isEmpty: !isLoadingState && !error && Boolean(address) && Boolean(snapshotId) && vaults.length === 0
  }
}
