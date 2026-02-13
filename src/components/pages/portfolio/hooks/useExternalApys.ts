import type { TExternalToken } from '@pages/portfolio/constants/externalTokens'
import { useQuery } from '@tanstack/react-query'

type TEnsoTokenResponse = {
  address: string
  chainId: number
  apy?: number
}

async function fetchEnsoTokenApys(tokens: TExternalToken[]): Promise<Record<string, number>> {
  if (tokens.length === 0) return {}

  const byChain = tokens.reduce((acc, token) => {
    const list = acc.get(token.chainId) ?? []
    return acc.set(token.chainId, [...list, token])
  }, new Map<number, TExternalToken[]>())

  const results: Record<string, number> = {}

  await Promise.all(
    Array.from(byChain.entries()).map(async ([chainId, chainTokens]) => {
      const params = new URLSearchParams()
      params.set('chainId', String(chainId))
      chainTokens.forEach((t) => {
        params.append('address[]', t.address)
      })

      try {
        const response = await fetch(`/api/enso/tokens?${params}`)
        if (!response.ok) return

        const data: TEnsoTokenResponse[] = await response.json()
        data
          .filter((item) => typeof item.apy === 'number' && item.apy > 0)
          .forEach((item) => {
            results[`${item.chainId}:${item.address.toLowerCase()}`] = item.apy!
          })
      } catch {
        // Silently fail — external cards simply won't show
      }
    })
  )

  return results
}

export function useExternalApys(detectedTokens: TExternalToken[]): {
  apyMap: Record<string, number>
  isLoading: boolean
} {
  const queryKey = detectedTokens.map((t) => `${t.chainId}:${t.address}`).join(',')

  const { data, isLoading } = useQuery({
    queryKey: ['external-apys', queryKey],
    queryFn: () => fetchEnsoTokenApys(detectedTokens),
    enabled: detectedTokens.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })

  return { apyMap: data ?? {}, isLoading }
}
