import { describe, expect, it } from 'vitest'

import { isVaultsIndexPath, normalizePathname } from './routes'

describe('normalizePathname', () => {
  it('keeps root pathname', () => {
    expect(normalizePathname('/')).toBe('/')
  })

  it('removes trailing slashes', () => {
    expect(normalizePathname('/vaults/')).toBe('/vaults')
    expect(normalizePathname('/vaults///')).toBe('/vaults')
  })
})

describe('isVaultsIndexPath', () => {
  it('matches only /vaults (after normalization)', () => {
    expect(isVaultsIndexPath('/vaults')).toBe(true)
    expect(isVaultsIndexPath('/vaults/')).toBe(true)
    expect(isVaultsIndexPath('/vaults/1/0x0')).toBe(false)
    expect(isVaultsIndexPath('/vaults-beta')).toBe(false)
  })
})
