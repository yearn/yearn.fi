import { toAddress } from '@shared/utils'

import type { TKongReport } from './kongReports.schema'

export function findLatestReportApr(reports: TKongReport[] | undefined, strategyAddress: string): number | null {
  if (!reports?.length || !strategyAddress) {
    return null
  }

  const normalizedStrategy = toAddress(strategyAddress)
  const filtered = reports.filter((report) => toAddress(report.strategy) === normalizedStrategy)
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
