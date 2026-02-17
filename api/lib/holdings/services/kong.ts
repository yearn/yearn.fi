import { config } from '../config'
import type { KongPPSDataPoint } from '../types'

export function parsePPSResponse(response: KongPPSDataPoint[]): Map<number, number> {
  return new Map(response.map((point) => [point.time, parseFloat(point.value)]))
}

export function interpolatePPS(ppsMap: Map<number, number>, timestamp: number): number {
  const timestamps = Array.from(ppsMap.keys()).sort((a, b) => a - b)

  if (timestamps.length === 0) {
    return 1.0
  }

  if (ppsMap.has(timestamp)) {
    return ppsMap.get(timestamp)!
  }

  if (timestamp < timestamps[0]) {
    return ppsMap.get(timestamps[0])!
  }

  if (timestamp > timestamps[timestamps.length - 1]) {
    return ppsMap.get(timestamps[timestamps.length - 1])!
  }

  const lower = timestamps.reduce((acc, ts) => (ts <= timestamp ? ts : acc), timestamps[0])
  const upper = timestamps.find((ts) => ts >= timestamp) ?? timestamps[timestamps.length - 1]

  if (lower === upper) {
    return ppsMap.get(lower)!
  }

  const lowerPPS = ppsMap.get(lower)!
  const upperPPS = ppsMap.get(upper)!
  const ratio = (timestamp - lower) / (upper - lower)

  return lowerPPS + (upperPPS - lowerPPS) * ratio
}

export async function fetchVaultPPS(chainId: number, vaultAddress: string): Promise<Map<number, number>> {
  const url = `${config.kongBaseUrl}/api/rest/timeseries/pps/${chainId}/${vaultAddress}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Kong API request failed: ${response.status} for ${vaultAddress}`)
  }

  const data = (await response.json()) as KongPPSDataPoint[]
  return parsePPSResponse(data)
}

export async function fetchMultipleVaultsPPS(
  vaults: Array<{ chainId: number; vaultAddress: string }>
): Promise<Map<string, Map<number, number>>> {
  const batchSize = 5
  const batches = Array.from({ length: Math.ceil(vaults.length / batchSize) }, (_, i) =>
    vaults.slice(i * batchSize, (i + 1) * batchSize)
  )

  return batches.reduce(async (accPromise, batch) => {
    const acc = await accPromise
    const batchResults = await Promise.all(
      batch.map(async ({ chainId, vaultAddress }) => {
        const key = `${chainId}:${vaultAddress.toLowerCase()}`
        try {
          const ppsMap = await fetchVaultPPS(chainId, vaultAddress)
          return { key, ppsMap }
        } catch (error) {
          console.error(`[Kong] Failed to fetch PPS for ${key}:`, error)
          return { key, ppsMap: new Map<number, number>() }
        }
      })
    )
    batchResults.forEach(({ key, ppsMap }) => {
      acc.set(key, ppsMap)
    })
    return acc
  }, Promise.resolve(new Map<string, Map<number, number>>()))
}
