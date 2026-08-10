import { formatWithSubscriptZeros } from '@shared/utils'
import { formatUnits, maxUint256 } from 'viem'

const UNLIMITED_ALLOWANCE_THRESHOLD = maxUint256 / 2n
const COMPACT_NOTATION_THRESHOLD = 10_000
const SCIENTIFIC_NOTATION_THRESHOLD = 1_000_000_000_000

export function isUnlimitedAllowance(allowance?: bigint): boolean {
  if (allowance === undefined) {
    return false
  }
  return allowance >= UNLIMITED_ALLOWANCE_THRESHOLD
}

function formatThreeSigCompact(amount: number): string {
  if (amount >= COMPACT_NOTATION_THRESHOLD) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
      minimumSignificantDigits: 3,
      maximumSignificantDigits: 3
    }).format(amount)
  }

  return new Intl.NumberFormat('en-US', {
    minimumSignificantDigits: 3,
    maximumSignificantDigits: 3
  }).format(amount)
}

function formatScientificFromNumber(amount: number): string {
  return amount.toExponential(2).replace('e+', 'e')
}

function formatStandardWithSignificantDigits(amount: number, significantDigits = 7): string {
  return new Intl.NumberFormat('en-US', {
    minimumSignificantDigits: 1,
    maximumSignificantDigits: Math.min(Math.max(significantDigits, 1), 21)
  }).format(amount)
}

function formatWidgetNormalizedValue(normalizedValue: number): string {
  if (Number.isNaN(normalizedValue)) {
    return '0'
  }

  if (!Number.isFinite(normalizedValue)) {
    return '∞'
  }

  if (normalizedValue === 0) {
    return '0'
  }

  const sign = normalizedValue < 0 ? '-' : ''
  const absolute = Math.abs(normalizedValue)
  const subscript = formatWithSubscriptZeros(absolute)
  if (subscript) {
    return `${sign}${subscript}`
  }

  if (absolute >= SCIENTIFIC_NOTATION_THRESHOLD) {
    return `${sign}${formatScientificFromNumber(absolute)}`
  }

  return `${sign}${formatThreeSigCompact(absolute)}`
}

export function formatWidgetValue(value: bigint | number, decimals = 18): string {
  if (typeof value === 'number') {
    return formatWidgetNormalizedValue(value)
  }
  return formatWidgetNormalizedValue(Number(formatUnits(value, decimals)))
}

export function formatWidgetPreciseValue(value: bigint | number, decimals = 18, significantDigits = 7): string {
  const normalizedValue = typeof value === 'number' ? value : Number(formatUnits(value, decimals))

  if (Number.isNaN(normalizedValue)) {
    return '0'
  }

  if (!Number.isFinite(normalizedValue)) {
    return '∞'
  }

  if (normalizedValue === 0) {
    return '0'
  }

  const sign = normalizedValue < 0 ? '-' : ''
  const absolute = Math.abs(normalizedValue)
  const subscript = formatWithSubscriptZeros(absolute, significantDigits)

  if (subscript) {
    return `${sign}${subscript}`
  }

  return `${sign}${formatStandardWithSignificantDigits(absolute, significantDigits)}`
}

export function formatWidgetAllowance(allowance?: bigint, decimals?: number): string | null {
  if (allowance === undefined || decimals === undefined) {
    return null
  }
  if (isUnlimitedAllowance(allowance)) {
    return 'Unlimited'
  }
  return formatWidgetValue(allowance, decimals)
}
