import { describe, expect, it } from 'vitest'
import {
  getCanonicalHoldingsVaultAddress,
  getHoldingsAliasVaultAddress,
  isYBoldProductAddress,
  mergeYBoldSnapshot,
  mergeYBoldVault,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS
} from './normalizeVault'

describe('yBOLD product helpers', () => {
  it('identifies the base and staked yBOLD vault addresses', () => {
    expect(isYBoldProductAddress(YBOLD_VAULT_ADDRESS)).toBe(true)
    expect(isYBoldProductAddress(YBOLD_STAKING_ADDRESS.toLowerCase())).toBe(true)
    expect(isYBoldProductAddress('0x0000000000000000000000000000000000000001')).toBe(false)
  })

  it('uses the staked net Oracle and historical performance', () => {
    const baseOracle = { apr: 0.0537, apy: 0.0551, netAPR: 0.0537, netAPY: 0.0551 }
    const stakedOracle = { apr: 0.0537, apy: 0.0551, netAPR: 0.0483, netAPY: 0.0495 }
    const stakedHistorical = { net: 0.0617, weeklyNet: 0.046, monthlyNet: 0.0617, inceptionNet: 0.0726 }
    const merged = mergeYBoldVault(
      {
        address: YBOLD_VAULT_ADDRESS,
        performance: { oracle: baseOracle, historical: null }
      } as any,
      {
        address: YBOLD_STAKING_ADDRESS,
        performance: { oracle: stakedOracle, historical: stakedHistorical }
      } as any
    )

    expect(merged.performance?.oracle).toEqual(stakedOracle)
    expect(merged.performance?.historical).toEqual(stakedHistorical)
  })

  it('uses the staked snapshot Oracle and APY history', () => {
    const baseOracle = { apr: 0.0537, apy: 0.0551, netAPR: 0.0537, netAPY: 0.0551 }
    const stakedOracle = { apr: 0.0537, apy: 0.0551, netAPR: 0.0483, netAPY: 0.0495 }
    const merged = mergeYBoldSnapshot(
      {
        performance: { oracle: baseOracle },
        apy: { weeklyNet: null }
      } as any,
      {
        performance: { oracle: stakedOracle },
        apy: { weeklyNet: 0.046 }
      } as any
    )

    expect(merged.performance?.oracle).toEqual(stakedOracle)
    expect(merged.apy?.weeklyNet).toBe(0.046)
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
