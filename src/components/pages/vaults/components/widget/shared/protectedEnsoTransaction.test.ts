import { describe, expect, it } from 'vitest'
import { isProtectedEnsoTransactionStepEnabled } from './protectedEnsoTransaction'

describe.each(['deposit', 'withdraw'])('%s protected Enso transaction step', () => {
  it('does not enable the raw prepare while the protected quote is not executable', () => {
    expect(
      isProtectedEnsoTransactionStepEnabled({
        canExecute: false,
        prepareEnabled: true
      })
    ).toBe(false)
  })

  it('enables only a prepared transaction from a ready protected quote', () => {
    expect(
      isProtectedEnsoTransactionStepEnabled({
        canExecute: true,
        prepareEnabled: true
      })
    ).toBe(true)
  })
})
