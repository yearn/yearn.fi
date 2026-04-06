import { exactToSimple } from '@shared/utils'
import { type ChangeEvent, type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import { parseUnits } from 'viem'

export interface DebouncedInputValue {
  formValue: string
  simple: number
  bn: bigint
  decimals: number
  touched: boolean
  activity: [boolean, Dispatch<SetStateAction<boolean>>]
  debouncedBn: bigint
  debouncedSimple: number
  isDebouncing: boolean
}

export type UseDebouncedInputReturnValue = [
  DebouncedInputValue,
  (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | undefined) => void,
  (formValue: string) => void,
  (debouncedFormValue: string) => void
]

// match escaped "." characters via in a non-capturing group
const inputRegex = /^\d*(?:\\[.])?\d*$/

// $& means the whole matched string  return
const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getExcessDecimals = (value: string, decimals: number) => decimals - (value.split('.')?.[1]?.length || decimals)

const tryParseString = (value: string, decimals: number) => {
  try {
    const excess = getExcessDecimals(value, decimals)
    if (excess < 0) return

    return parseUnits(value || '0', decimals)
  } catch {
    // don't update the input on invalid values
    return
  }
}

export const useDebouncedInput = (decimals = 18, debounceMs = 500): UseDebouncedInputReturnValue => {
  const [formValue, setFormValue] = useState<string>('')
  const [debouncedFormValue, setDebouncedFormValue] = useState<string>('')

  const activity = useState(false)

  // Render-time state adjustment: trim form value when decimals decrease
  const [whole, fraction] = formValue.split('.')
  if (fraction && fraction.length > decimals) {
    setFormValue(`${whole}.${fraction.slice(0, decimals)}`)
  }

  // Derived: debouncing when form value differs from debounced value
  const isDebouncing = formValue !== debouncedFormValue

  // Timer to settle debounced value — external sync (useEffect required)
  useEffect(() => {
    if (formValue === debouncedFormValue) return
    const handler = setTimeout(() => setDebouncedFormValue(formValue), debounceMs)
    return () => clearTimeout(handler)
  }, [formValue, debounceMs])

  // Handle callback, no change if number is invalid
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | undefined) => {
      if (!event) return

      const rawInput = event.target.value.replace(/,/g, '.')

      if (rawInput === '' || inputRegex.test(escapeRegExp(rawInput))) {
        const [whole, fraction] = rawInput.split('.')
        const nextUserInput =
          fraction && fraction.length > decimals ? `${whole}.${fraction.slice(0, decimals)}` : rawInput
        setFormValue(nextUserInput)
      }
    },
    [decimals]
  )

  // State change on formValue / decimals
  const state = useMemo(() => {
    const bn = tryParseString(formValue, decimals) || 0n
    const simple = exactToSimple(bn, decimals) || 0
    const debouncedBn = tryParseString(debouncedFormValue, decimals) || 0n
    const debouncedSimple = exactToSimple(debouncedBn, decimals) || 0

    return {
      formValue: formValue || '',
      decimals,
      simple,
      bn,
      debouncedBn,
      debouncedSimple,
      touched: formValue !== '',
      activity,
      isDebouncing
    }
  }, [decimals, formValue, debouncedFormValue, activity[0], isDebouncing])

  return [state, handleChange, setFormValue, setDebouncedFormValue]
}
