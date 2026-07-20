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

export type TYvUsdCooldownSummary = {
  label: string
  detail: string
  tone: 'cooling' | 'ready' | 'expired'
}

export function resolveCooldownWindowState(params: {
  hasActiveCooldown: boolean
  nowTimestamp: number
  cooldownEnd: number
  windowEnd: number
  availableWithdrawLimit: bigint
}): {
  isCooldownActive: boolean
  isWithdrawalWindowOpen: boolean
  isCooldownWindowExpired: boolean
} {
  const { hasActiveCooldown, nowTimestamp, cooldownEnd, windowEnd, availableWithdrawLimit } = params
  const canWithdrawNow = availableWithdrawLimit > 0n

  return {
    isCooldownActive: hasActiveCooldown && !canWithdrawNow && nowTimestamp < cooldownEnd,
    isWithdrawalWindowOpen:
      canWithdrawNow || (hasActiveCooldown && nowTimestamp >= cooldownEnd && nowTimestamp <= windowEnd),
    isCooldownWindowExpired: hasActiveCooldown && !canWithdrawNow && nowTimestamp > windowEnd
  }
}

export function resolveYvUsdCooldownSummary(params: {
  hasActiveCooldown: boolean
  isCooldownActive: boolean
  isWithdrawalWindowOpen: boolean
  isCooldownWindowExpired: boolean
}): TYvUsdCooldownSummary | null {
  const { hasActiveCooldown, isCooldownActive, isWithdrawalWindowOpen, isCooldownWindowExpired } = params

  if (!hasActiveCooldown) {
    return null
  }

  if (isWithdrawalWindowOpen) {
    return {
      label: 'Ready to withdraw',
      detail: 'Locked yvUSD cooldown completed.',
      tone: 'ready'
    }
  }

  if (isCooldownActive) {
    return {
      label: 'Cooling down',
      detail: 'Locked yvUSD is still in cooldown.',
      tone: 'cooling'
    }
  }

  if (isCooldownWindowExpired) {
    return {
      label: 'Cooldown expired',
      detail: 'Withdrawal window closed. Start a new cooldown to withdraw.',
      tone: 'expired'
    }
  }

  return {
    label: 'Cooldown pending',
    detail: 'Cooldown status is being refreshed.',
    tone: 'cooling'
  }
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

export const resolveDurationSeconds = (rawDuration: unknown, fallbackDays: number): number => {
  if (typeof rawDuration === 'bigint') {
    return Number(rawDuration)
  }

  return fallbackDays * 86_400
}
