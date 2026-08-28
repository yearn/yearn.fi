import { describe, expect, it } from 'vitest'
import {
  BOLD_ADDRESS,
  YBOLD_CHAIN_ID,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS,
  YBOLD_ZAPPER_ADDRESS,
  YEARN_YBOLD_VAULT_URL
} from './ybold'

describe('yBOLD preset', () => {
  it('pins the audited mainnet contracts', () => {
    expect(YBOLD_CHAIN_ID).toBe(1)
    expect(BOLD_ADDRESS).toBe('0x6440f144b7e50D6a8439336510312d2F54beB01D')
    expect(YBOLD_VAULT_ADDRESS).toBe('0x9F4330700a36B29952869fac9b33f45EEdd8A3d8')
    expect(YBOLD_STAKING_ADDRESS).toBe('0x23346B04a7f55b8760E5860AA5A77383D63491cD')
    expect(YBOLD_ZAPPER_ADDRESS).toBe('0xe7099092533a3fb693bb123cd96b8e53b4d83c58')
    expect(YEARN_YBOLD_VAULT_URL).toBe(`https://yearn.fi/v3/1/${YBOLD_VAULT_ADDRESS}`)
  })
})
