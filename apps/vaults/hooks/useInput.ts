import { exactToSimple } from '@lib/utils'
import { type ChangeEvent, type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import { parseUnits } from 'viem'

export interface InputValue {
  formValue: string
  simple: number
  bn: bigint
  decimals: number
  touched: boolean
  activity: [boolean, Dispatch<SetStateAction<boolean>>]
}

export type UseInputReturnValue = [
  InputValue,
  (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | undefined) => void,
  (formValue: string) => void
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

const createUseInputHook =
  (useInputCtx = useState, formatter?: (v?: number) => number | undefined) =>
  (decimals = 18): UseInputReturnValue => {
    const [formValue, setFormValue] = useInputCtx<string>('')

    const activity = useState(false)

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
      [setFormValue, decimals]
    )

    // Trim existing if beyond decimal limit
    useEffect(() => {
      setFormValue((prev) => {
        const [whole, fraction] = prev.split('.')
        return fraction && fraction.length > decimals ? `${whole}.${fraction.slice(0, decimals)}` : prev
      })
    }, [setFormValue, decimals])

    // State change on formValue / decimals
    // biome-ignore lint/correctness/useExhaustiveDependencies: <>
    const state = useMemo(() => {
      const bn = tryParseString(formValue, decimals) || 0n
      const simple = exactToSimple(bn, decimals) || 0
      return {
        formValue: formValue || '',
        decimals,
        simple: !!formatter ? formatter(simple) || 0 : simple,
        bn,
        touched: formValue !== '',
        activity
      }
    }, [decimals, formValue, activity[0]])

    return [state, handleChange, setFormValue]
  }

export const useInput = createUseInputHook(undefined)
