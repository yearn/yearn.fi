import { buildVaultSnapshotEndpoint } from '@shared/data/publicQueryEndpoints'
import { useFetch } from '@shared/hooks/useFetch'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { kongVaultSnapshotSchema } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { useMemo } from 'react'

type UseVaultSnapshotProps = {
  chainId?: number
  address?: string
}

export function useVaultSnapshot({ chainId, address }: UseVaultSnapshotProps) {
  const endpoint = useMemo(() => {
    return buildVaultSnapshotEndpoint(chainId, address)
  }, [chainId, address])

  const result = useFetch<TKongVaultSnapshot>({
    endpoint,
    schema: kongVaultSnapshotSchema,
    config: {
      cacheDuration: 30 * 1000,
      keepPreviousData: false
    }
  })

  return result
}
