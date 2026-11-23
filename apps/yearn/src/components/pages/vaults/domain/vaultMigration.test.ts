import { WidgetActionType } from '@pages/vaults/types'
import { describe, expect, it } from 'vitest'
import { getVaultWidgetActions, isListedMigrationTarget } from './vaultMigration'

const TARGET = '0x2222222222222222222222222222222222222222'
const catalog = { [TARGET]: { chainId: 1, address: TARGET } } as any

describe('isListedMigrationTarget', () => {
  it('accepts a target listed in the catalog on the same chain', () => {
    expect(isListedMigrationTarget(catalog, 1, TARGET)).toBe(true)
  })

  it('rejects targets missing from the catalog, on another chain, or absent', () => {
    expect(isListedMigrationTarget(catalog, 1, '0x3333333333333333333333333333333333333333')).toBe(false)
    expect(isListedMigrationTarget(catalog, 10, TARGET)).toBe(false)
    expect(isListedMigrationTarget({}, 1, TARGET)).toBe(false)
    expect(isListedMigrationTarget(catalog, 1, undefined)).toBe(false)
  })
})

describe('getVaultWidgetActions', () => {
  it('offers Migrate only when migration is allowed', () => {
    expect(getVaultWidgetActions({ isRetired: true, isMigratable: true, canMigrate: true })).toEqual([
      WidgetActionType.Migrate,
      WidgetActionType.Withdraw
    ])
    expect(getVaultWidgetActions({ isRetired: false, isMigratable: true, canMigrate: false })).toEqual([
      WidgetActionType.Withdraw
    ])
  })

  it('keeps Deposit and Withdraw for active vaults', () => {
    expect(getVaultWidgetActions({ isRetired: false, isMigratable: false, canMigrate: false })).toEqual([
      WidgetActionType.Deposit,
      WidgetActionType.Withdraw
    ])
  })
})
