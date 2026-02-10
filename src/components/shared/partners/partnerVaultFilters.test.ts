import { describe, expect, it } from 'vitest'
import { isAerodromeVaultListItem } from './isAerodromeVaultListItem'
import { isCurveVaultListItem } from './isCurveVaultListItem'
import { isMorphoVaultListItem } from './isMorphoVaultListItem'
import { isPoolTogetherVaultListItem } from './isPoolTogetherVaultListItem'
import { isVelodromeVaultListItem } from './isVelodromeVaultListItem'

describe('category-based partner filters', () => {
  it('matches curve vaults by category', () => {
    expect(isCurveVaultListItem({ category: 'Curve' })).toBe(true)
    expect(isCurveVaultListItem({ category: 'curve' })).toBe(true)
    expect(isCurveVaultListItem({ category: 'Pendle' })).toBe(false)
  })

  it('matches aerodrome vaults by category', () => {
    expect(isAerodromeVaultListItem({ category: 'Aerodrome' })).toBe(true)
    expect(isAerodromeVaultListItem({ category: 'aerodrome' })).toBe(true)
    expect(isAerodromeVaultListItem({ category: 'Velodrome' })).toBe(false)
  })

  it('matches velodrome vaults by category', () => {
    expect(isVelodromeVaultListItem({ category: 'Velodrome' })).toBe(true)
    expect(isVelodromeVaultListItem({ category: 'velodrome' })).toBe(true)
    expect(isVelodromeVaultListItem({ category: 'Aerodrome' })).toBe(false)
  })
})

describe('inclusion-flag partner filters', () => {
  it('matches morpho vaults by inclusion flag', () => {
    expect(isMorphoVaultListItem({ inclusion: { isMorpho: true } })).toBe(true)
    expect(isMorphoVaultListItem({ inclusion: { isMorpho: false } })).toBe(false)
    expect(isMorphoVaultListItem({ inclusion: {} })).toBe(false)
  })

  it('matches pooltogether vaults by inclusion flag', () => {
    expect(isPoolTogetherVaultListItem({ inclusion: { isPoolTogether: true } })).toBe(true)
    expect(isPoolTogetherVaultListItem({ inclusion: { isPoolTogether: false } })).toBe(false)
    expect(isPoolTogetherVaultListItem({ inclusion: {} })).toBe(false)
  })
})
