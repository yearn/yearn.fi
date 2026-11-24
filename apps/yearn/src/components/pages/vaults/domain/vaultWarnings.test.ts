import { WidgetActionType } from '@pages/vaults/types'
import { YVBTC_CHAIN_ID, YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { describe, expect, it } from 'vitest'
import {
  getNonYearnAcknowledgementStorageKey,
  getVaultHeadingName,
  isNonYearnErc4626Vault,
  NON_YEARN_ERC4626_WARNING_MESSAGE,
  requiresNonYearnAcknowledgement
} from './vaultWarnings'

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
          chainId: YVBTC_CHAIN_ID,
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

  it('returns false when no vault is known yet', () => {
    expect(isNonYearnErc4626Vault({})).toBe(false)
  })

  it('flags the yvBTC address on any other chain', () => {
    const otherChainId = YVBTC_CHAIN_ID === 1 ? 10 : 1
    const item = { chainId: otherChainId, address: YVBTC_UNLOCKED_ADDRESS, origin: null, inclusion: {} } as any

    expect(isNonYearnErc4626Vault({ vault: item })).toBe(true)
  })
})

describe('requiresNonYearnAcknowledgement', () => {
  it('blocks every action except Withdraw on a non-Yearn vault until acknowledged', () => {
    expect(
      requiresNonYearnAcknowledgement({
        action: WidgetActionType.Deposit,
        isNonYearnVault: true,
        hasAcknowledged: false
      })
    ).toBe(true)
    expect(
      requiresNonYearnAcknowledgement({
        action: WidgetActionType.Migrate,
        isNonYearnVault: true,
        hasAcknowledged: false
      })
    ).toBe(true)
    expect(
      requiresNonYearnAcknowledgement({
        action: WidgetActionType.Withdraw,
        isNonYearnVault: true,
        hasAcknowledged: false
      })
    ).toBe(false)
  })

  it('unblocks a non-Yearn vault once acknowledged', () => {
    expect(
      requiresNonYearnAcknowledgement({
        action: WidgetActionType.Deposit,
        isNonYearnVault: true,
        hasAcknowledged: true
      })
    ).toBe(false)
  })

  it('never blocks Yearn vaults', () => {
    expect(
      requiresNonYearnAcknowledgement({
        action: WidgetActionType.Deposit,
        isNonYearnVault: false,
        hasAcknowledged: false
      })
    ).toBe(false)
  })
})

describe('getNonYearnAcknowledgementStorageKey', () => {
  it('scopes the acknowledgement to one chain and address regardless of address casing', () => {
    const address = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'

    expect(getNonYearnAcknowledgementStorageKey(1, address)).toBe(
      getNonYearnAcknowledgementStorageKey(1, address.toLowerCase())
    )
    expect(getNonYearnAcknowledgementStorageKey(1, address)).not.toBe(getNonYearnAcknowledgementStorageKey(10, address))
    expect(getNonYearnAcknowledgementStorageKey(1, address)).not.toBe(
      getNonYearnAcknowledgementStorageKey(1, '0x1111111111111111111111111111111111111111')
    )
  })
})

describe('getVaultHeadingName', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678'

  it('appends the vault address to non-Yearn vault names', () => {
    expect(getVaultHeadingName({ name: 'yvUSDC', address, isNonYearnVault: true })).toBe('yvUSDC · 0x1234...5678')
  })

  it('keeps Yearn vault names unchanged', () => {
    expect(getVaultHeadingName({ name: 'yvUSDC', address, isNonYearnVault: false })).toBe('yvUSDC')
  })
})
