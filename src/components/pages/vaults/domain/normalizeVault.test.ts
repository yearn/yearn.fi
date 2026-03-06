import { describe, expect, it } from 'vitest'
import {
  getCanonicalHoldingsVaultAddress,
  getHoldingsAliasVaultAddress,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS
} from './normalizeVault'

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
