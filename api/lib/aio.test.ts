import { describe, expect, it } from 'vitest'

import { buildVaultsMarkdown, getVaultMarkdownListKind, type TVaultListEntry } from './aio'

function address(seed: number): string {
  return `0x${seed.toString(16).padStart(40, '0')}`
}

function vault(overrides: Partial<TVaultListEntry>): TVaultListEntry {
  return {
    chainId: 1,
    address: address(1),
    name: 'Test Vault',
    symbol: 'yvTEST',
    apiVersion: '3.0.0',
    asset: { name: 'Test Token', symbol: 'TEST' },
    tvl: 1_000,
    performance: null,
    isHidden: false,
    isRetired: false,
    v3: true,
    type: 'Yearn Vault',
    kind: 'Multi Strategy',
    origin: 'yearn',
    inclusion: { isYearn: true },
    ...overrides
  }
}

describe('buildVaultsMarkdown', () => {
  it('uses the public Yearn catalog and keeps only single asset and LP vaults without a TVL minimum', () => {
    const vaults = [
      vault({
        address: address(1),
        name: 'Single Asset Low TVL',
        tvl: 0
      }),
      vault({
        address: address(2),
        name: 'LP Token Vault',
        apiVersion: '2.0.0',
        v3: false,
        type: 'Automated Yearn Vault',
        kind: null
      }),
      vault({
        address: address(3),
        name: 'Underlying Strategy',
        kind: 'Single Strategy'
      }),
      vault({
        address: address(4),
        name: 'Legacy Vault',
        apiVersion: '2.0.0',
        v3: false,
        kind: 'Legacy',
        type: 'Yearn Vault'
      }),
      vault({
        address: address(5),
        name: 'Hidden Vault',
        isHidden: true
      }),
      vault({
        address: address(6),
        name: 'Retired Vault',
        isRetired: true
      }),
      vault({
        address: address(7),
        name: 'Partner Vault',
        origin: 'partner'
      }),
      vault({
        address: address(8),
        name: 'Excluded Yearn Vault',
        inclusion: { isYearn: false }
      })
    ]

    const markdown = buildVaultsMarkdown(vaults)

    expect(markdown).toContain('total_vaults: 2')
    expect(markdown).toContain('[Single Asset Low TVL]')
    expect(markdown).toContain('[LP Token Vault]')
    expect(markdown).toContain('No TVL minimum is applied')
    expect(markdown).not.toContain('Underlying Strategy')
    expect(markdown).not.toContain('Legacy Vault')
    expect(markdown).not.toContain('Hidden Vault')
    expect(markdown).not.toContain('Retired Vault')
    expect(markdown).not.toContain('Partner Vault')
    expect(markdown).not.toContain('Excluded Yearn Vault')
  })

  it('applies the chain filter after public catalog filtering', () => {
    const markdown = buildVaultsMarkdown(
      [
        vault({ address: address(1), name: 'Ethereum Single Asset', chainId: 1 }),
        vault({
          address: address(2),
          name: 'Base LP Token',
          chainId: 8453,
          apiVersion: '2.0.0',
          v3: false,
          type: 'Automated Yearn Vault',
          kind: null
        })
      ],
      8453
    )

    expect(markdown).toContain('total_vaults: 1')
    expect(markdown).toContain('[Base LP Token]')
    expect(markdown).not.toContain('Ethereum Single Asset')
  })
})

describe('getVaultMarkdownListKind', () => {
  it('matches the vault page product buckets', () => {
    expect(getVaultMarkdownListKind(vault({ kind: 'Multi Strategy' }))).toBe('singleAsset')
    expect(getVaultMarkdownListKind(vault({ kind: 'Single Strategy' }))).toBe('strategy')
    expect(
      getVaultMarkdownListKind(vault({ apiVersion: '2.0.0', v3: false, type: 'Automated Yearn Vault', kind: null }))
    ).toBe('lp')
    expect(getVaultMarkdownListKind(vault({ apiVersion: '2.0.0', v3: false, kind: 'Legacy' }))).toBe('legacy')
  })
})
