import { config } from '../config'
import type { KongPPSDataPoint } from '../types'

export type PPSTimeline = Map<number, number>

export function buildPPSTimeline(response: KongPPSDataPoint[]): PPSTimeline {
  return new Map(response.map((p) => [p.time, parseFloat(p.value)]))
}

export function getPPS(timeline: PPSTimeline, timestamp: number): number {
  // Exact match
  if (timeline.has(timestamp)) {
    return timeline.get(timestamp)!
  }

  // Find closest timestamp (Kong only has midnight timestamps)
  if (timeline.size === 0) {
    return 1.0
  }

  const timestamps = Array.from(timeline.keys()).sort((a, b) => a - b)

  // If target is before all data, use earliest
  if (timestamp < timestamps[0]) {
    return timeline.get(timestamps[0])!
  }

  // Find the latest timestamp that's <= target (most recent PPS before/at this time)
  let closest = timestamps[0]
  for (const ts of timestamps) {
    if (ts <= timestamp) {
      closest = ts
    } else {
      break
    }
  }

  return timeline.get(closest) ?? 1.0
}

export async function fetchVaultPPS(chainId: number, vaultAddress: string): Promise<PPSTimeline> {
  const url = `${config.kongBaseUrl}/api/rest/timeseries/pps/${chainId}/${vaultAddress}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Kong API request failed: ${response.status} for ${vaultAddress}`)
  }

  const data = (await response.json()) as KongPPSDataPoint[]
  return buildPPSTimeline(data)
}

export async function fetchMultipleVaultsPPS(
  vaults: Array<{ chainId: number; vaultAddress: string }>
): Promise<Map<string, PPSTimeline>> {
  const promises = vaults.map(async ({ chainId, vaultAddress }) => {
    const key = `${chainId}:${vaultAddress.toLowerCase()}`
    try {
      const timeline = await fetchVaultPPS(chainId, vaultAddress)
      return { key, timeline }
    } catch (error) {
      console.error(`[Kong] Failed to fetch PPS for ${key}:`, error)
      return { key, timeline: new Map() as PPSTimeline }
    }
  })

  const results = await Promise.all(promises)

  const map = new Map<string, PPSTimeline>()
  for (const { key, timeline } of results) {
    map.set(key, timeline)
  }

  return map
}
