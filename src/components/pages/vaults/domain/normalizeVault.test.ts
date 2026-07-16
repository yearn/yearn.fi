import { describe, expect, it } from 'vitest'
import {
  getCanonicalHoldingsVaultAddress,
  getHoldingsAliasVaultAddress,
  isYBoldProductAddress,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS
} from './normalizeVault'

describe('yBOLD product helpers', () => {
  it('identifies the base and staked yBOLD vault addresses', () => {
    expect(isYBoldProductAddress(YBOLD_VAULT_ADDRESS)).toBe(true)
    expect(isYBoldProductAddress(YBOLD_STAKING_ADDRESS.toLowerCase())).toBe(true)
    expect(isYBoldProductAddress('0x0000000000000000000000000000000000000001')).toBe(false)
  })
})

describe('holdings alias helpers', () => {
  it('maps the yBOLD staking wrapper to the base vault', () => {
    expect(getHoldingsAliasVaultAddress(YBOLD_STAKING_ADDRESS)).toBe(YBOLD_VAULT_ADDRESS)
    expect(getCanonicalHoldingsVaultAddress(YBOLD_STAKING_ADDRESS)).toBe(YBOLD_VAULT_ADDRESS)
  })

  it('keeps non-aliased vaults canonicalized to themselves', () => {
    expect(getHoldingsAliasVaultAddress(YBOLD_VAULT_ADDRESS)).toBeUndefined()
    expect(getCanonicalHoldingsVaultAddress(YBOLD_VAULT_ADDRESS)).toBe(YBOLD_VAULT_ADDRESS)
  })
})
