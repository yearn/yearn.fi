import { toast } from '@shared/components/yToast'

const toastedSnapshotEndpoints = new Set<string>()

export function maybeToastSnapshot(endpoint: string, address?: string, source?: string): void {
  if (!import.meta.env.DEV) {
    return
  }
  if (toastedSnapshotEndpoints.has(endpoint)) {
    return
  }

  toastedSnapshotEndpoints.add(endpoint)
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'vault'
  const suffix = source ? ` (${source})` : ''

  toast({
    content: `Snapshot fetched for ${shortAddress}${suffix}`,
    type: 'info',
    duration: 2500
  })
}
