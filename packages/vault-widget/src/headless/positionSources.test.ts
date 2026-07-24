import { describe, expect, it } from 'vitest'
import type { VaultWidgetConfig, VaultWidgetPositionSourceState, VaultWidgetToken } from '../types'
import {
  getAvailableVaultWidgetModes,
  getDefaultPositionSource,
  getPositionSources,
  sumPositionValues
} from './positionSources'

const token: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 18,
  name: 'Vault share',
  symbol: 'yvTOKEN'
}

function createConfig(): VaultWidgetConfig {
  return {
    adapters: [],
    chainId: 1,
    depositTokens: [token],
    id: 'test',
    name: 'Test vault',
    positionToken: token,
    vaultAddress: token.address,
    withdrawTokens: [token]
  }
}

describe('position sources', () => {
  it('only exposes migration when the account owns migratable shares', () => {
    const modes = ['migrate', 'withdraw', 'info'] as const

    expect(getAvailableVaultWidgetModes(modes, 0n)).toEqual(['withdraw', 'info'])
    expect(getAvailableVaultWidgetModes(modes, 1n)).toEqual(modes)
  })

  it('creates a backward-compatible source from the legacy position token', () => {
    const readPositionValue = async (_client: never, balance: bigint): Promise<bigint> => balance * 2n
    const config = { ...createConfig(), readPositionValue } as VaultWidgetConfig

    expect(getPositionSources(config)).toEqual([
      {
        id: 'default',
        label: 'yvTOKEN',
        readValue: readPositionValue,
        token
      }
    ])
  })

  it('selects a preferred source and sums asset-denominated values', () => {
    const sources: readonly VaultWidgetPositionSourceState[] = [
      { balance: 2n, id: 'vault', label: 'Vault shares', token, value: 3n },
      { balance: 4n, id: 'staked', label: 'Staked shares', token, value: 5n }
    ]

    expect(getDefaultPositionSource(sources, 'staked').id).toBe('staked')
    expect(sumPositionValues(sources)).toBe(8n)
  })
})
