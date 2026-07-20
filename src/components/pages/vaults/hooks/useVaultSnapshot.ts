import { PUBLIC_VAULT_DATA_CACHE_TIME } from '@shared/data/publicQueryCache'
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
      cacheDuration: PUBLIC_VAULT_DATA_CACHE_TIME,
      keepPreviousData: false
    }
  })

  return result
}
