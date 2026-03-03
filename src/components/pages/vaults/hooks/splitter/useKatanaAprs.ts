import type { TKatanaAprs } from '@pages/vaults/types/splitter'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

const KATANA_APR_API = 'https://katana-apr.yearn.fi/api'

const fetchKatanaAprs = async (): Promise<TKatanaAprs> => {
  const res = await fetch(KATANA_APR_API)
  if (!res.ok) throw new Error('Failed to fetch Katana APRs')
  return res.json()
}

export const useKatanaAprs = (vaultAddress?: string) => {
  const { data: aprs, isLoading } = useQuery({
    queryKey: ['katana-aprs'],
    queryFn: fetchKatanaAprs,
    staleTime: 5 * 60_000,
    enabled: !!vaultAddress
  })

  const vaultApr = useMemo(() => {
    if (!aprs || !vaultAddress) return undefined
    const key = Object.keys(aprs).find((k) => k.toLowerCase() === vaultAddress.toLowerCase())
    return key ? aprs[key] : undefined
  }, [aprs, vaultAddress])

  const nativeApy = useMemo(() => {
    if (!vaultApr) return 0
    const extra = vaultApr.apr.extra
    return (extra.katanaNativeYield || 0) + (extra.extrinsicYield || 0)
  }, [vaultApr])

  const rewardsApy = useMemo(() => {
    if (!vaultApr) return 0
    const extra = vaultApr.apr.extra
    return (extra.katanaAppRewardsAPR || 0) + (extra.FixedRateKatanaRewards || 0)
  }, [vaultApr])

  return { nativeApy, rewardsApy, isLoading }
}
