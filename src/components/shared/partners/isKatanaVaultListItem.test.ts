import { describe, expect, it } from 'vitest'
import { isKatanaVaultListItem } from './isKatanaVaultListItem'

describe('isKatanaVaultListItem', () => {
  it('includes vaults explicitly flagged as katana', () => {
    expect(isKatanaVaultListItem({ chainId: 1, inclusion: { isKatana: true } })).toBe(true)
    expect(isKatanaVaultListItem({ chainId: 747474, inclusion: { isKatana: true } })).toBe(true)
  })

  it('excludes vaults explicitly flagged as non-katana', () => {
    expect(isKatanaVaultListItem({ chainId: 747474, inclusion: { isKatana: false } })).toBe(false)
    expect(isKatanaVaultListItem({ chainId: 1, inclusion: { isKatana: false } })).toBe(false)
  })

  it('falls back to katana chain when inclusion flag is absent', () => {
    expect(isKatanaVaultListItem({ chainId: 747474, inclusion: {} })).toBe(true)
    expect(isKatanaVaultListItem({ chainId: 747474 })).toBe(true)
    expect(isKatanaVaultListItem({ chainId: 1, inclusion: {} })).toBe(false)
  })
})
