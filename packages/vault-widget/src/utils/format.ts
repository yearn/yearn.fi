import type { TNormalizedBN, TNumberish } from '@yearn/vault-widget/types'
import { formatUnits, parseUnits } from 'viem'

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const

function toSubscript(value: number): string {
  return value
    .toString()
    .split('')
    .map((digit) => SUBSCRIPT_DIGITS[Number.parseInt(digit, 10)] ?? '')
    .join('')
}

export function formatWithSubscriptZeros(amount: number, maxSignificantDigits = 4): string | null {
  if (amount <= 0 || amount >= 0.0001) {
    return null
  }

  const afterDecimal = amount.toFixed(20).split('.')[1]
  const zeroCount = afterDecimal?.match(/^0+/)?.[0].length ?? 0
  if (!afterDecimal || zeroCount < 4) {
    return null
  }

  const significantDigits = afterDecimal.slice(zeroCount, zeroCount + maxSignificantDigits).replace(/0+$/, '') || '0'
  return `0.0${toSubscript(zeroCount - 1)}${significantDigits}`
}

export function toBigInt(value?: TNumberish | null): bigint {
  if (value === undefined || value === null || value === '') {
    return 0n
  }
  if (typeof value === 'bigint') {
    return value
  }

  const stringValue = String(value).trim()
  const integerValue = stringValue.includes('.') ? stringValue.split('.')[0] : stringValue
  try {
    return BigInt(integerValue || '0')
  } catch {
    return 0n
  }
}

export function simpleToExact(value: number | string = 0, decimals = 18): bigint {
  return parseUnits(String(value || '0'), decimals)
}

export function exactToSimple(value?: bigint | number | string, decimals = 18): number {
  return Number.parseFloat(formatUnits(toBigInt(value), decimals))
}

export function toNormalizedBN(value: TNumberish, decimals: number): TNormalizedBN {
  const raw = toBigInt(value)
  const display = formatUnits(raw, decimals)
  return {
    raw,
    normalized: Number(display),
    display,
    decimals
  }
}

export const zeroNormalizedBN: TNormalizedBN = toNormalizedBN(0n, 18)

export type TAmountOptions = {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  shouldDisplaySymbol?: boolean
  shouldCompactValue?: boolean
}

export type TAmount = {
  value: bigint | number
  decimals: number | bigint
  symbol?: string
  options?: TAmountOptions
}

function formatNumber(
  value: number,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  compact = false
): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
    ...(compact ? { notation: 'compact' as const, compactDisplay: 'short' as const } : {})
  }).format(value)
}

export function formatTAmount({ value, decimals, symbol = '', options = {} }: TAmount): string {
  const amount = typeof value === 'bigint' ? Number(formatUnits(value, Number(decimals))) : value
  if (!Number.isFinite(amount)) {
    return '∞'
  }

  const subscriptValue = formatWithSubscriptZeros(amount)
  const formatted =
    subscriptValue ??
    formatNumber(
      amount,
      options.minimumFractionDigits ?? 2,
      options.maximumFractionDigits ?? 2,
      options.shouldCompactValue !== false && Math.abs(amount) > 10_000
    )
  const shouldDisplaySymbol = options.shouldDisplaySymbol !== false && symbol.length > 0
  const displaySymbol = symbol.toUpperCase() === 'PERCENT' ? '%' : symbol
  return shouldDisplaySymbol ? `${formatted} ${displaySymbol}` : formatted
}

export function formatPercent(value: number, min?: number, max?: number, upperLimit = 500): string {
  const safeValue = Number.isFinite(value) ? value : 0
  const boundedValue = Math.min(safeValue, upperLimit)
  const formatted = formatNumber(boundedValue, min ?? 0, max ?? (min === undefined ? 2 : min))
  return `${safeValue >= upperLimit ? '≥ ' : ''}${formatted}%`
}

export function formatCounterValue(amount: number | string, price: number): string {
  const value = (Number(amount) || 0) * (price || 0)
  return `$${formatNumber(value, value > 10_000 ? 0 : 2, value > 10_000 ? 0 : 2, value > 10_000)}`
}
