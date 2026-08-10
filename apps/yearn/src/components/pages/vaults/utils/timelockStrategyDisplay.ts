import { toNormalizedBN } from '@shared/utils'

export function formatTimelockEta(etaSeconds: number, nowMs = Date.now()): string {
  const etaMs = etaSeconds * 1000
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
  const formattedDate = formatter.format(new Date(etaMs))

  if (etaMs <= nowMs) {
    return formattedDate
  }

  return formattedDate
}

export function formatTimelockMaxDebt(maxDebtRaw: string | undefined, decimals: number, tokenSymbol: string): string {
  if (!maxDebtRaw) {
    return '-'
  }

  const normalized = Number(toNormalizedBN(maxDebtRaw, decimals).normalized)

  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(normalized)} ${tokenSymbol}`
}

export function getTimelockBadgeLabel(status: 'queued' | 'ready'): string {
  return status === 'ready' ? 'Timelock ready' : 'Pending timelock'
}
