'use client'

import { useQuery } from '@tanstack/react-query'
import type { TSiteHealth } from '@/types/siteStatus'

async function fetchSiteHealth(): Promise<TSiteHealth> {
  const response = await fetch('/api/status', { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Site status request failed (${response.status})`)
  }
  return (await response.json()) as TSiteHealth
}

export function useSiteHealth(initialHealth?: TSiteHealth) {
  return useQuery({
    queryKey: ['site-status'],
    queryFn: fetchSiteHealth,
    initialData: initialHealth,
    initialDataUpdatedAt: initialHealth ? Date.parse(initialHealth.checkedAt) : undefined,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1
  })
}
