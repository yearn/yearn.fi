import { config } from '../config'
import type { KongPPSDataPoint } from '../types'

export function parsePPSResponse(response: KongPPSDataPoint[]): Map<number, number> {
  const ppsMap = new Map<number, number>()

  for (const point of response) {
    ppsMap.set(point.time, parseFloat(point.value))
  }

  return ppsMap
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

  let lower = timestamps[0]
  let upper = timestamps[timestamps.length - 1]

  for (const ts of timestamps) {
    if (ts <= timestamp) {
      lower = ts
    }
    if (ts >= timestamp && ts < upper) {
      upper = ts
      break
    }
  }

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
  const results = new Map<string, Map<number, number>>()

  const batchSize = 5
  for (let i = 0; i < vaults.length; i += batchSize) {
    const batch = vaults.slice(i, i + batchSize)
    const promises = batch.map(async ({ chainId, vaultAddress }) => {
      const key = `${chainId}:${vaultAddress.toLowerCase()}`
      try {
        const ppsMap = await fetchVaultPPS(chainId, vaultAddress)
        return { key, ppsMap }
      } catch (error) {
        console.error(`[Kong] Failed to fetch PPS for ${key}:`, error)
        return { key, ppsMap: new Map<number, number>() }
      }
    })

    const batchResults = await Promise.all(promises)
    for (const { key, ppsMap } of batchResults) {
      results.set(key, ppsMap)
    }
  }

  return results
}
