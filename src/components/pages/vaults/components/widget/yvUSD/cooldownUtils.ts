export type TYvUsdCooldownStatus = {
  cooldownEnd: number
  windowEnd: number
  shares: bigint
}

export const EMPTY_COOLDOWN_STATUS: TYvUsdCooldownStatus = {
  cooldownEnd: 0,
  windowEnd: 0,
  shares: 0n
}

function parseCooldownTimestamp(value: unknown): number {
  return typeof value === 'bigint' ? Number(value) : 0
}

function parseCooldownShares(value: unknown): bigint {
  return typeof value === 'bigint' ? value : 0n
}

export function parseCooldownStatus(status: unknown): TYvUsdCooldownStatus {
  if (!status) return EMPTY_COOLDOWN_STATUS

  if (Array.isArray(status)) {
    const [cooldownEnd, windowEnd, shares] = status
    return {
      cooldownEnd: parseCooldownTimestamp(cooldownEnd),
      windowEnd: parseCooldownTimestamp(windowEnd),
      shares: parseCooldownShares(shares)
    }
  }

  if (typeof status === 'object' && status !== null) {
    const parsed = status as {
      cooldownEnd?: unknown
      windowEnd?: unknown
      shares?: unknown
    }
    return {
      cooldownEnd: parseCooldownTimestamp(parsed.cooldownEnd),
      windowEnd: parseCooldownTimestamp(parsed.windowEnd),
      shares: parseCooldownShares(parsed.shares)
    }
  }

  return EMPTY_COOLDOWN_STATUS
}

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const totalSeconds = Math.floor(seconds)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const secs = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

export const formatDays = (seconds: number, fallbackDays: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return `${fallbackDays} days`
  const days = seconds / 86_400
  const rounded = Math.round(days * 100) / 100
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded} days`
}
