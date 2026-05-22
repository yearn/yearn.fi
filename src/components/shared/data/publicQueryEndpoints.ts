import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { isAddress } from 'viem'
import { toAddress } from '../utils'

export const YEARN_TVL_ENDPOINT = 'https://api.llama.fi/tvl/yearn'
export const YEARN_VAULT_LIST_ENDPOINT = `${KONG_REST_BASE}/list/vaults`

export function buildVaultSnapshotEndpoint(chainId?: number | string, address?: string): string | null {
  const resolvedChainId = Number(chainId)
  if (!Number.isInteger(resolvedChainId) || !address || !isAddress(address)) {
    return null
  }

  return `${KONG_REST_BASE}/snapshot/${resolvedChainId}/${toAddress(address)}`
}
