const DEFAULT_API_URL = 'https://api.clusters.xyz/v1'
const DEFAULT_IMAGE_CDN = 'https://cdn.clusters.xyz/profile'

const clusterNameCache = new Map<string, string | null>()

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_CLUSTERS_API_URL
  return (envUrl && envUrl.trim().length > 0 ? envUrl : DEFAULT_API_URL).replace(/\/$/, '')
}

const getApiKey = (): string | undefined => {
  const key = import.meta.env.VITE_CLUSTERS_API_KEY
  return key && key.trim().length > 0 ? key : undefined
}

const buildRequestHeaders = (): HeadersInit => {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const apiKey = getApiKey()
  if (apiKey) {
    headers['X-API-KEY'] = apiKey
  }
  return headers
}

const parseClusterNameResponse = (payload: unknown): string | null => {
  if (typeof payload === 'string') {
    return payload.length > 0 ? payload : null
  }

  if (payload && typeof payload === 'object' && 'name' in payload) {
    const { name } = payload as { name?: unknown }
    if (typeof name === 'string' && name.length > 0) {
      return name
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
    const response = await fetch(`${getApiBaseUrl()}/name/${normalizedAddress}`, {
      headers: buildRequestHeaders()
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
  const [clusterName] = name.toLowerCase().split('/')
  return `${DEFAULT_IMAGE_CDN}/${clusterName}`
}
