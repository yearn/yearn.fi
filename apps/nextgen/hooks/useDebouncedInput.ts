import { exactToSimple } from '@lib/utils'
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
  const [isDebouncing, setIsDebouncing] = useState(false)

  const activity = useState(false)

  // Debounce the form value
  useEffect(() => {
    if (formValue === debouncedFormValue) {
      setIsDebouncing(false)
      return
    }

    setIsDebouncing(true)
    const handler = setTimeout(() => {
      setDebouncedFormValue(formValue)
      setIsDebouncing(false)
    }, debounceMs)

    return () => {
      clearTimeout(handler)
    }
  }, [formValue, debounceMs])

  // Handle callback, no change if number is invalid
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | undefined) => {
      if (!event) return

      let nextUserInput = event.target.value.replace(/,/g, '.')

      if (nextUserInput === '' || inputRegex.test(escapeRegExp(nextUserInput))) {
        const [whole, fraction] = nextUserInput.split('.')
        if (fraction && fraction.length > decimals) {
          nextUserInput = `${whole}.${fraction.slice(0, decimals)}`
        }
        setFormValue(nextUserInput)
      }
    },
    [decimals]
  )

  // Trim existing if beyond decimal limit
  useEffect(() => {
    setFormValue((prev) => {
      const [whole, fraction] = prev.split('.')
      return fraction && fraction.length > decimals ? `${whole}.${fraction.slice(0, decimals)}` : prev
    })
  }, [decimals])

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
