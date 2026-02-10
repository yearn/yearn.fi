import { describe, expect, it } from 'vitest'
import { resolvePartnerFromPath } from './resolvePartnerFromPath'

describe('resolvePartnerFromPath', () => {
  it('resolves known partner routes', () => {
    expect(resolvePartnerFromPath('/aerodrome')).toBe('aerodrome')
    expect(resolvePartnerFromPath('/curve')).toBe('curve')
    expect(resolvePartnerFromPath('/katana')).toBe('katana')
    expect(resolvePartnerFromPath('/morpho')).toBe('morpho')
    expect(resolvePartnerFromPath('/pooltogether')).toBe('pooltogether')
    expect(resolvePartnerFromPath('/velodrome')).toBe('velodrome')
    expect(resolvePartnerFromPath('/katana/')).toBe('katana')
    expect(resolvePartnerFromPath('/KATANA')).toBe('katana')
  })

  it('returns undefined for non-partner routes', () => {
    expect(resolvePartnerFromPath('/')).toBeUndefined()
    expect(resolvePartnerFromPath('/vaults')).toBeUndefined()
    expect(resolvePartnerFromPath('/portfolio')).toBeUndefined()
    expect(resolvePartnerFromPath('/pendle')).toBeUndefined()
    expect(resolvePartnerFromPath('/katana/extra')).toBeUndefined()
  })
})
