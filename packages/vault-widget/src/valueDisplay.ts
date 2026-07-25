import { formatUnits, maxUint256 } from 'viem'

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
const UNLIMITED_ALLOWANCE_THRESHOLD = maxUint256 / 2n
const COMPACT_NOTATION_THRESHOLD = 10_000
const SCIENTIFIC_NOTATION_THRESHOLD = 1_000_000_000_000

function toSubscript(value: number): string {
  return value
    .toString()
    .split('')
    .map((digit) => SUBSCRIPT_DIGITS[Number.parseInt(digit, 10)])
    .join('')
}

function formatWithSubscriptZeros(amount: number, maxSignificantDigits = 4): string | null {
  if (amount <= 0 || amount >= 0.0001) return null

  const fraction = amount.toFixed(20).split('.')[1]
  if (!fraction) return null

  let zeroCount = 0
  for (const character of fraction) {
    if (character !== '0') break
    zeroCount += 1
  }
  if (zeroCount < 4) return null

  const significantPart = fraction.slice(zeroCount)
  const significantDigits = significantPart.slice(0, maxSignificantDigits).replace(/0+$/, '') || '0'
  return `0.0${toSubscript(zeroCount - 1)}${significantDigits}`
}

function formatThreeSignificantDigits(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    ...(amount >= COMPACT_NOTATION_THRESHOLD ? { notation: 'compact', compactDisplay: 'short' } : {}),
    minimumSignificantDigits: 3,
    maximumSignificantDigits: 3
  }).format(amount)
}

function formatNormalizedWidgetValue(value: number): string {
  if (Number.isNaN(value)) return '0'
  if (!Number.isFinite(value)) return '∞'
  if (value === 0) return '0'

  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  const subscript = formatWithSubscriptZeros(absolute)
  if (subscript) return `${sign}${subscript}`
  if (absolute >= SCIENTIFIC_NOTATION_THRESHOLD) {
    return `${sign}${absolute.toExponential(2).replace('e+', 'e')}`
  }
  return `${sign}${formatThreeSignificantDigits(absolute)}`
}

export function formatWidgetValue(value: bigint | number, decimals = 18): string {
  const normalized = typeof value === 'number' ? value : Number(formatUnits(value, decimals))
  return formatNormalizedWidgetValue(normalized)
}

export function formatWidgetAllowance(value: bigint, decimals: number): string {
  if (value >= UNLIMITED_ALLOWANCE_THRESHOLD) return 'Unlimited'
  return formatWidgetValue(value, decimals)
}

export function formatRewardAmount(value: bigint, decimals: number): string {
  const amount = Number(formatUnits(value, decimals))
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatWalletBalance(value: bigint, decimals: number): string {
  const amount = Number(formatUnits(value, decimals))
  if (!Number.isFinite(amount)) return '∞'
  if (amount === 0) return '0'

  const subscript = formatWithSubscriptZeros(amount)
  if (subscript) return subscript

  let maximumFractionDigits = 2
  if (amount < 0.01) {
    maximumFractionDigits = amount > 0.00000001 ? 8 : amount > 0.000000000001 ? 12 : decimals
  }

  return new Intl.NumberFormat('en-US', {
    ...(amount > COMPACT_NOTATION_THRESHOLD ? { notation: 'compact', compactDisplay: 'short' } : {}),
    minimumFractionDigits: 2,
    maximumFractionDigits
  }).format(amount)
}
