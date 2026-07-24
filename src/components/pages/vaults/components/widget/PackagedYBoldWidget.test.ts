import { resolvePackagedYBoldMode } from '@pages/vaults/components/widget/PackagedYBoldWidget'
import { WidgetActionType } from '@pages/vaults/types'
import { describe, expect, it } from 'vitest'

describe('resolvePackagedYBoldMode', () => {
  it('maps the existing yearn.fi action state into package modes', () => {
    expect(resolvePackagedYBoldMode(WidgetActionType.Deposit, false)).toBe('deposit')
    expect(resolvePackagedYBoldMode(WidgetActionType.Withdraw, false)).toBe('withdraw')
    expect(resolvePackagedYBoldMode(WidgetActionType.Deposit, true)).toBe('info')
  })
})
