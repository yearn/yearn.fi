import { toAddress } from '@shared/utils'

import type { TKongReport } from './kongReports.schema'

export function findLatestReportApr(
  reports: TKongReport[] | undefined,
  strategyAddress: string,
  options?: { maxAgeSeconds?: number }
): number | null {
  if (!reports?.length || !strategyAddress) {
    return null
  }

  const normalizedStrategy = toAddress(strategyAddress)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const maxAgeSeconds = options?.maxAgeSeconds
  const filtered = reports.filter((report) => {
    if (toAddress(report.strategy) !== normalizedStrategy) {
      return false
    }
    if (!maxAgeSeconds) {
      return true
    }
    const reportTime = report.blockTime ?? 0
    const reportSeconds = reportTime > 1_000_000_000_000 ? Math.floor(reportTime / 1000) : reportTime
    return reportSeconds > 0 && nowSeconds - reportSeconds <= maxAgeSeconds
  })
  if (!filtered.length) {
    return null
  }

  const latest = filtered.reduce((prev, curr) => {
    const prevTime = prev.blockTime ?? 0
    const currTime = curr.blockTime ?? 0
    if (currTime > prevTime) {
      return curr
    }
    if (currTime < prevTime) {
      return prev
    }

    const prevBlock = prev.blockNumber ?? 0
    const currBlock = curr.blockNumber ?? 0
    if (currBlock > prevBlock) {
      return curr
    }
    if (currBlock < prevBlock) {
      return prev
    }

    const prevLog = prev.logIndex ?? 0
    const currLog = curr.logIndex ?? 0
    return currLog > prevLog ? curr : prev
  })

  return latest.apr?.net ?? null
}
