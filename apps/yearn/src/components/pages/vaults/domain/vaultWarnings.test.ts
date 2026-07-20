import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { describe, expect, it } from 'vitest'
import { isNonYearnErc4626Vault, NON_YEARN_ERC4626_WARNING_MESSAGE } from './vaultWarnings'

describe('NON_YEARN_ERC4626_WARNING_MESSAGE', () => {
  it('matches the expected copy', () => {
    expect(NON_YEARN_ERC4626_WARNING_MESSAGE).toBe(
      'This is a non-Yearn ERC-4626 Vault. Please be careful when interacting with it.'
    )
  })
})

describe('isNonYearnErc4626Vault', () => {
  it('returns false for catalog Yearn vaults', () => {
    expect(
      isNonYearnErc4626Vault({
        vault: {
          origin: 'yearn',
          inclusion: { isYearn: true }
        } as any
      })
    ).toBe(false)
  })

  it('returns true when the list origin is missing', () => {
    expect(
      isNonYearnErc4626Vault({
        vault: {
          origin: null,
          inclusion: {}
        } as any
      })
    ).toBe(true)
  })

  it('returns false for yvBTC while Kong metadata is incomplete', () => {
    expect(
      isNonYearnErc4626Vault({
        vault: {
          address: YVBTC_UNLOCKED_ADDRESS,
          origin: null,
          inclusion: {}
        } as any
      })
    ).toBe(false)
  })

  it('returns true when the list origin is not yearn', () => {
    expect(
      isNonYearnErc4626Vault({
        vault: {
          origin: 'partner',
          inclusion: { isYearn: true }
        } as any
      })
    ).toBe(true)
  })

  it('returns true when inclusion explicitly marks the vault as non-Yearn', () => {
    expect(
      isNonYearnErc4626Vault({
        vault: {
          origin: 'yearn',
          inclusion: { isYearn: false }
        } as any
      })
    ).toBe(true)
  })

  it('returns true from snapshot metadata when list metadata is unavailable', () => {
    expect(
      isNonYearnErc4626Vault({
        snapshot: {
          inclusion: { isYearn: false }
        } as any
      })
    ).toBe(true)
  })
})
