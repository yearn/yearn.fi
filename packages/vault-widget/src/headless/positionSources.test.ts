import { describe, expect, it } from 'vitest'
import type { VaultWidgetConfig, VaultWidgetPositionSourceState, VaultWidgetToken } from '../types'
import {
  getAvailableVaultWidgetModes,
  getDefaultPositionSource,
  getPositionSources,
  getSelectablePositionSources,
  isModeAvailabilityPending,
  resolveWithdrawPositionSource,
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

  it('does not discard a controlled migration mode before its balance is known', () => {
    const account = '0x2222222222222222222222222222222222222222'

    expect(isModeAvailabilityPending('migrate', undefined, false)).toBe(true)
    expect(isModeAvailabilityPending('migrate', account, true)).toBe(true)
    expect(isModeAvailabilityPending('migrate', account, false)).toBe(false)
    expect(isModeAvailabilityPending('withdraw', undefined, true)).toBe(false)
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

  it.each([
    { balances: [0n, 0n], expected: 'vault', selectable: [] },
    { balances: [2n, 0n], expected: 'vault', selectable: [] },
    { balances: [0n, 4n], expected: 'staked', selectable: [] },
    { balances: [2n, 4n], expected: 'vault', selectable: ['vault', 'staked'] }
  ])('resolves funded withdrawal sources for balances $balances', ({
    balances,
    expected,
    selectable
  }: {
    balances: bigint[]
    expected: string
    selectable: string[]
  }) => {
    const sources: readonly VaultWidgetPositionSourceState[] = [
      { balance: balances[0]!, id: 'vault', label: 'Vault shares', token, value: balances[0]! },
      { balance: balances[1]!, id: 'staked', label: 'Staked shares', token, value: balances[1]! }
    ]

    expect(resolveWithdrawPositionSource(sources, 'vault').id).toBe(expected)
    expect(getSelectablePositionSources(sources).map(({ id }) => id)).toEqual(selectable)
  })

  it('preserves the selected funded source when both positions have balances', () => {
    const sources: readonly VaultWidgetPositionSourceState[] = [
      { balance: 2n, id: 'vault', label: 'Vault shares', token, value: 2n },
      { balance: 4n, id: 'staked', label: 'Staked shares', token, value: 4n }
    ]

    expect(resolveWithdrawPositionSource(sources, 'staked').id).toBe('staked')
  })
})
