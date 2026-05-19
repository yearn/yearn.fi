const DEFAULT_API_URL = 'https://api.clusters.xyz/v1'
const DEFAULT_IMAGE_CDN = 'https://cdn.clusters.xyz/profile'

const clusterNameCache = new Map<string, string | null>()

const normalizeNamePart = (value: string): string => value.trim().toLowerCase()

const parseClusterNameResponse = (payload: unknown): string | null => {
  if (typeof payload === 'string') {
    const normalized = normalizeNamePart(payload)
    return normalized.length > 0 ? normalized : null
  }

  if (payload && typeof payload === 'object') {
    const { clusterName, walletName, name } = payload as {
      clusterName?: unknown
      walletName?: unknown
      name?: unknown
    }

    if (typeof clusterName === 'string' && clusterName.length > 0) {
      const baseName = normalizeNamePart(clusterName)
      if (typeof walletName === 'string' && walletName.length > 0) {
        return `${baseName}/${normalizeNamePart(walletName)}`
      }
      return baseName
    }

    if (typeof name === 'string' && name.length > 0) {
      return normalizeNamePart(name)
    }
  }

  return null
}

export async function fetchClusterName(address: string): Promise<string | null> {
  if (!address) {
    return null
  }

  const normalizedAddress = address.toLowerCase()
  if (clusterNameCache.has(normalizedAddress)) {
    return clusterNameCache.get(normalizedAddress) ?? null
  }

  try {
    const response = await fetch(`${DEFAULT_API_URL}/names/address/${normalizedAddress}`, {
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) {
      if (response.status === 404) {
        clusterNameCache.set(normalizedAddress, null)
        return null
      }
      throw new Error(`Clusters API responded with status ${response.status}`)
    }

    const payload = await response.json()
    const clusterName = parseClusterNameResponse(payload)
    clusterNameCache.set(normalizedAddress, clusterName)
    return clusterName
  } catch (error) {
    console.error('Failed to resolve cluster name', error)
    clusterNameCache.set(normalizedAddress, null)
    return null
  }
}

export const getClusterImageUrl = (name: string): string => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return DEFAULT_IMAGE_CDN
  }
  const [clusterName] = name.toLowerCase().split('/')
  return `${DEFAULT_IMAGE_CDN}/${clusterName}`
}
