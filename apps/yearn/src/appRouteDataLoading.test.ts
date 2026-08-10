import { describe, expect, it } from 'vitest'
import { isVaultDetailPathname, isVaultsListPathname, shouldLoadAppTokenLists } from '@/appRouteDataLoading'

describe('app route data loading', () => {
  it('identifies vault list routes', () => {
    expect(isVaultsListPathname('/vaults')).toBe(true)
    expect(isVaultsListPathname('/vaults?type=v3')).toBe(true)
    expect(isVaultsListPathname('/v3')).toBe(true)
    expect(isVaultsListPathname('/portfolio')).toBe(false)
  })

  it('identifies vault detail routes', () => {
    expect(isVaultDetailPathname('/vaults/1/0x0000000000000000000000000000000000000001')).toBe(true)
    expect(isVaultDetailPathname('/v3/1/0x0000000000000000000000000000000000000001')).toBe(true)
    expect(isVaultDetailPathname('/vaults/1/not-an-address')).toBe(false)
    expect(isVaultDetailPathname('/vaults')).toBe(false)
  })

  it('keeps token lists lazy on vault list and detail routes', () => {
    expect(shouldLoadAppTokenLists('/vaults')).toBe(false)
    expect(shouldLoadAppTokenLists('/vaults/1/0x0000000000000000000000000000000000000001')).toBe(false)
    expect(shouldLoadAppTokenLists('/portfolio')).toBe(true)
  })
})
