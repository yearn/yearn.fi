import {
  getVaultAddress,
  getVaultChainID,
  getVaultToken,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import {
  CURVE_CHAIN_NAMES,
  getIdleCurveEstimate,
  isCurvePoolApyCandidate,
  isIdleCurveVault,
  resolveCurvePoolApys
} from '@pages/vaults/utils/curvePoolApy'
import { PUBLIC_VAULT_DATA_CACHE_TIME } from '@shared/data/publicQueryCache'
import { buildVaultSnapshotEndpoint } from '@shared/data/publicQueryEndpoints'
import { baseFetcher } from '@shared/utils/fetchers'
import { fetchWithSchema, getFetchQueryKey } from '@shared/utils/fetchQuery'
import { kongVaultSnapshotSchema, type TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

function useCurvePoolApys(chainIds: number[]): Map<number, Record<string, number>> {
  const chains = [...new Set(chainIds)].filter((chainId) => CURVE_CHAIN_NAMES[chainId])
  const queries = useQueries({
    queries: chains.map((chainId) => ({
      queryKey: ['curve-base-apys', chainId],
      queryFn: async () => {
        const chain = CURVE_CHAIN_NAMES[chainId]
        const [pools, apys] = await Promise.all([
          baseFetcher<unknown>(`https://api.curve.finance/v1/getPools/all/${chain}`),
          baseFetcher<unknown>(`https://api.curve.finance/v1/getBaseApys/${chain}`)
        ])
        return resolveCurvePoolApys(pools, apys)
      },
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false
    }))
  })
  return new Map(queries.flatMap((query, index) => (query.data ? [[chains[index], query.data]] : [])))
}

export function useCurvePoolApySnapshot(snapshot: TKongVaultSnapshot | undefined): TKongVaultSnapshot | undefined {
  const apys = useCurvePoolApys(isIdleCurveVault(snapshot) ? [snapshot.chainId] : [])
  const poolApys = snapshot ? apys.get(snapshot.chainId) : undefined
  return useMemo(() => {
    const estimated = getIdleCurveEstimate(snapshot, poolApys)
    return snapshot && estimated ? { ...snapshot, performance: { ...snapshot.performance, estimated } } : snapshot
  }, [snapshot, poolApys])
}

export function useCurvePoolApyVaults<T extends TKongVaultInput>(vaults: T[]): T[] {
  const candidates = vaults.filter(isCurvePoolApyCandidate)
  // Reuse the detail-page snapshot cache; the list response does not contain allocation balances.
  const snapshots = useQueries({
    queries: candidates.map((vault) => {
      const endpoint = buildVaultSnapshotEndpoint(getVaultChainID(vault), getVaultAddress(vault))!
      return {
        queryKey: getFetchQueryKey(endpoint)!,
        queryFn: () => fetchWithSchema(endpoint, kongVaultSnapshotSchema),
        staleTime: PUBLIC_VAULT_DATA_CACHE_TIME,
        refetchOnWindowFocus: false,
        retry: false
      }
    })
  })
  const apys = useCurvePoolApys(snapshots.flatMap(({ data }) => (isIdleCurveVault(data) ? [data.chainId] : [])))
  const estimates = new Map(
    candidates.flatMap((vault, index) => {
      const snapshot = snapshots[index].data
      const chainId = getVaultChainID(vault)
      if (
        snapshot?.chainId !== chainId ||
        snapshot.address.toLowerCase() !== getVaultAddress(vault).toLowerCase() ||
        snapshot.asset?.address.toLowerCase() !== getVaultToken(vault).address.toLowerCase()
      )
        return []
      const estimated = getIdleCurveEstimate(snapshot, apys.get(chainId))
      return estimated ? [[`${chainId}:${vault.address.toLowerCase()}`, estimated]] : []
    })
  )

  return vaults.map((vault) => {
    const estimated = estimates.get(`${getVaultChainID(vault)}:${vault.address.toLowerCase()}`)
    if (!estimated) return vault
    if ('chainID' in vault) {
      return {
        ...vault,
        apr: {
          ...vault.apr,
          forwardAPR: {
            ...vault.apr.forwardAPR,
            type: estimated.type,
            netAPR: estimated.apy,
            composite: {
              ...vault.apr.forwardAPR.composite,
              poolAPY: estimated.apy,
              boost: 0,
              baseAPR: 0,
              boostedAPR: 0,
              cvxAPR: 0,
              rewardsAPR: 0
            }
          }
        }
      }
    }
    return { ...vault, performance: { ...vault.performance, estimated } }
  })
}
