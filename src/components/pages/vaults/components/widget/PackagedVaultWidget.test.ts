import { resolvePackagedVaultMode } from '@pages/vaults/components/widget/PackagedVaultWidget'
import { WidgetActionType } from '@pages/vaults/types'
import { describe, expect, it } from 'vitest'

describe('resolvePackagedVaultMode', () => {
  it('maps yearn.fi action and overlay state into package modes', () => {
    expect(resolvePackagedVaultMode(WidgetActionType.Deposit, false, false)).toBe('deposit')
    expect(resolvePackagedVaultMode(WidgetActionType.Withdraw, false, false)).toBe('withdraw')
    expect(resolvePackagedVaultMode(WidgetActionType.Migrate, false, false)).toBe('migrate')
    expect(resolvePackagedVaultMode(WidgetActionType.Deposit, true, false)).toBe('info')
    expect(resolvePackagedVaultMode(WidgetActionType.Deposit, false, true)).toBe('rewards')
  })
})
