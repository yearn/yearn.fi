import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { useFetch } from '@shared/hooks/useFetch'
import { toAddress } from '@shared/utils'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { kongVaultSnapshotSchema } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { useMemo } from 'react'

type UseVaultSnapshotProps = {
  chainId?: number
  address?: string
}

export function useVaultSnapshot({ chainId, address }: UseVaultSnapshotProps) {
  const normalizedAddress = useMemo(() => (address ? toAddress(address) : undefined), [address])
  const endpoint = useMemo(() => {
    if (!normalizedAddress || !Number.isInteger(chainId)) return null
    return `${KONG_REST_BASE}/snapshot/${chainId}/${normalizedAddress}`
  }, [chainId, normalizedAddress])

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
