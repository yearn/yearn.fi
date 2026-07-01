import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { toAddress } from '@shared/utils'
import { describe, expect, it } from 'vitest'
import { getVaultTenderlyOverrideTokens } from './useTenderlyVaultBalanceOverrides'

const ASSET_ADDRESS = toAddress('0x1111111111111111111111111111111111111111')
const STAKING_ADDRESS = toAddress('0x2222222222222222222222222222222222222222')

function tokenKeys(tokens: ReturnType<typeof getVaultTenderlyOverrideTokens>): string[] {
  return tokens.map((token) => `${token.chainID}:${token.address}`)
}

describe('getVaultTenderlyOverrideTokens', () => {
  it('includes the current vault, underlying asset, and staking token', () => {
    const tokens = getVaultTenderlyOverrideTokens({
      currentVault: {
        address: toAddress('0x3333333333333333333333333333333333333333'),
        chainID: 1,
        decimals: 18,
        name: 'Example Vault',
        symbol: 'yvEX',
        token: {
          address: ASSET_ADDRESS,
          decimals: 6,
          name: 'Example Asset',
          symbol: 'EX'
        }
      },
      stakingAddress: STAKING_ADDRESS
    })

    expect(tokenKeys(tokens)).toEqual([
      `1:${toAddress('0x3333333333333333333333333333333333333333')}`,
      `1:${ASSET_ADDRESS}`,
      `1:${STAKING_ADDRESS}`
    ])
    expect(tokens[0].isVaultToken).toBe(true)
    expect(tokens[2].isStakingToken).toBe(true)
  })

  it('adds both yvUSD variants when the current vault is a yvUSD vault', () => {
    const tokens = getVaultTenderlyOverrideTokens({
      currentVault: {
        address: YVUSD_UNLOCKED_ADDRESS,
        chainID: YVUSD_CHAIN_ID,
        decimals: 6,
        name: 'yvUSD',
        symbol: 'yvUSD',
        token: {
          address: ASSET_ADDRESS,
          decimals: 6,
          name: 'USDC',
          symbol: 'USDC'
        }
      }
    })

    expect(tokenKeys(tokens)).toContain(`${YVUSD_CHAIN_ID}:${YVUSD_UNLOCKED_ADDRESS}`)
    expect(tokenKeys(tokens)).toContain(`${YVUSD_CHAIN_ID}:${YVUSD_LOCKED_ADDRESS}`)
  })

  it('keeps the yvBTC locked placeholder out of the override list until it has a real address', () => {
    const tokens = getVaultTenderlyOverrideTokens({
      currentVault: {
        address: YVBTC_UNLOCKED_ADDRESS,
        chainID: 1,
        decimals: 8,
        name: 'yvBTC',
        symbol: 'yvBTC',
        token: {
          address: ASSET_ADDRESS,
          decimals: 8,
          name: 'Bitcoin',
          symbol: 'BTC'
        }
      }
    })

    expect(tokenKeys(tokens)).toEqual([`1:${YVBTC_UNLOCKED_ADDRESS}`, `1:${ASSET_ADDRESS}`])
  })
})
