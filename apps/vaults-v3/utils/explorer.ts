import { getNetwork } from '@lib/utils/wagmi/utils'

export function getExplorerAddressUrl(chainID: number, address: string): string {
  const base = getNetwork(chainID)?.defaultBlockExplorer || ''
  return `${base}/address/${address}`
}
