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

export const parseCooldownStatus = (status: unknown): TYvUsdCooldownStatus => {
  if (!status) return EMPTY_COOLDOWN_STATUS

  if (Array.isArray(status)) {
    const [cooldownEnd, windowEnd, shares] = status
    return {
      cooldownEnd: typeof cooldownEnd === 'bigint' ? Number(cooldownEnd) : 0,
      windowEnd: typeof windowEnd === 'bigint' ? Number(windowEnd) : 0,
      shares: typeof shares === 'bigint' ? shares : 0n
    }
  }

  if (typeof status === 'object') {
    const parsed = status as {
      cooldownEnd?: unknown
      windowEnd?: unknown
      shares?: unknown
    }
    return {
      cooldownEnd: typeof parsed.cooldownEnd === 'bigint' ? Number(parsed.cooldownEnd) : 0,
      windowEnd: typeof parsed.windowEnd === 'bigint' ? Number(parsed.windowEnd) : 0,
      shares: typeof parsed.shares === 'bigint' ? parsed.shares : 0n
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
