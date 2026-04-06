type TStrategiesPercentFormatOptions = {
  locales?: string[]
  upperLimit?: number
}

function resolveLocales(options?: TStrategiesPercentFormatOptions): string[] {
  const locales: string[] = []
  if (options?.locales) {
    locales.push(...options.locales)
  }
  if (typeof navigator !== 'undefined') {
    locales.push(navigator.language || 'en-US')
  }
  locales.push('en-US')
  return locales
}

function resolveFractionDigits(value: number): number {
  const absoluteValue = Math.abs(value)
  if (absoluteValue >= 100) {
    return 0
  }
  if (absoluteValue >= 10) {
    return 1
  }
  return 2
}

function formatWithPaddedFractionDigits(value: number, options?: TStrategiesPercentFormatOptions): string {
  const fractionDigits = resolveFractionDigits(value)
  return new Intl.NumberFormat(resolveLocales(options), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)
}

export function formatStrategiesPercent(value: number, options?: TStrategiesPercentFormatOptions): string {
  if (value === Infinity || value === -Infinity) {
    return '∞%'
  }

  const safeValue = Number.isFinite(value) ? value : 0
  const upperLimit = options?.upperLimit ?? 500
  if (safeValue >= upperLimit) {
    return `≥ ${formatWithPaddedFractionDigits(upperLimit, options)}%`
  }
  return `${formatWithPaddedFractionDigits(safeValue, options)}%`
}

export function formatStrategiesApy(
  value: number | null | undefined,
  options?: TStrategiesPercentFormatOptions
): string {
  if (value === Infinity || value === -Infinity) {
    return '∞%'
  }
  const numericValue = typeof value === 'number' ? value : 0
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0
  return formatStrategiesPercent(safeValue * 100, options)
}
