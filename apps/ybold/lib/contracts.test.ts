import { describe, expect, it } from 'vitest'
import { BOLD, ST_YBOLD, YBOLD, YEARN_VAULT_URL } from './contracts'

describe('shared yBOLD contract configuration', () => {
  it('uses the vault-widget package as its contract source of truth', () => {
    expect(BOLD).toBe('0x6440f144b7e50D6a8439336510312d2F54beB01D')
    expect(YBOLD).toBe('0x9F4330700a36B29952869fac9b33f45EEdd8A3d8')
    expect(ST_YBOLD).toBe('0x23346B04a7f55b8760E5860AA5A77383D63491cD')
    expect(YEARN_VAULT_URL).toBe(`https://yearn.fi/v3/1/${YBOLD}`)
  })
})
