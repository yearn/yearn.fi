import { buildCards } from '@wrapped/lib/cards'
import { chartGeometry } from '@wrapped/lib/chart'
import { demo } from '@wrapped/lib/demo'
import { renderCard } from '@wrapped/lib/export'
import { parseWrapped } from '@yearn/wrapped-contract'
import { describe, expect, it } from 'vitest'

describe('Wrapped stories', () => {
  it('rejects identity exports even when called directly', async () => {
    await expect(renderCard(buildCards(demo)[0]!, true)).rejects.toThrow('Identity cards cannot be exported.')
  })
  it('shares a valid contract with the holdings producer', () => {
    expect(parseWrapped(demo)).toEqual(demo)
  })
  it('retains unavailable rather than displaying zero return and removes unverified rankings', () => {
    const cards = buildCards({
      ...demo,
      return: { ...demo.return, pct: null, isComplete: false },
      vaults: demo.vaults.map((vault) => ({ ...vault, isComplete: false }))
    })
    expect(cards.find((card) => card.id === 'return')!.value).toBe('Still a story.')
    expect(cards.some((card) => card.id === 'home')).toBe(false)
    expect(cards.some((card) => card.id === 'streak')).toBe(false)
  })
  it('keeps zero and losses visible and omits addresses from exportable card models', () => {
    expect(
      buildCards({ ...demo, return: { ...demo.return, pct: 0 } }).find((card) => card.id === 'return')!.value
    ).toBe('0%')
    expect(
      buildCards({ ...demo, return: { ...demo.return, pct: -4 } }).find((card) => card.id === 'return')!.value
    ).toBe('-4%')
    const cards = buildCards(demo)
    expect(JSON.stringify(cards.filter((card) => card.id !== 'identity'))).not.toContain(demo.address)
  })
  it('uses common chart geometry for screen and exports', () => {
    const points = [
      { label: 'a', value: 100 },
      { label: 'b', value: 105 },
      { label: 'c', value: 110 }
    ]
    expect(chartGeometry(points, 800, 160).line).toBe('M0,160 L400,80 L800,0')
    expect(chartGeometry(points, 960, 140).line).toBe('M0,140 L480,70 L960,0')
  })
})
