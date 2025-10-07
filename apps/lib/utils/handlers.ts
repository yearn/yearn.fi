import type { TNormalizedBN } from '../types/mixed'
import { DefaultTNormalizedBN, parseUnits } from './format'

export function handleInputChangeEventValue(e: React.ChangeEvent<HTMLInputElement>, decimals?: number): TNormalizedBN {
  const resolvedDecimals = decimals ?? 18
  const { valueAsNumber, value } = e.target
  const amount = valueAsNumber
  if (Number.isNaN(amount)) {
    return { ...DefaultTNormalizedBN, decimals: resolvedDecimals }
  }
  if (amount === 0) {
    let amountStr = value.replace(/,/g, '.').replace(/[^0-9.]/g, '')
    const amountParts = amountStr.split('.')
    if (amountParts[0]?.length > 1 && Number(amountParts[0]) === 0) {
      //
    } else {
      //check if we have 0 everywhere
      if (amountParts.every((part: string): boolean => Number(part) === 0)) {
        if (amountParts.length === 2) {
          amountStr = amountParts[0] + '.' + amountParts[1].slice(0, resolvedDecimals)
        }
        const raw = parseUnits((amountStr || '0') as `${number}`, resolvedDecimals)
        return { raw, normalized: Number(amountStr) || 0, display: amountStr, decimals: resolvedDecimals }
      }
    }
  }

  const raw = parseUnits(amount.toFixed(decimals) || '0', resolvedDecimals)
  return { raw, normalized: amount || 0, display: amount.toFixed(decimals), decimals: resolvedDecimals }
}
