import { describe, expect, it } from 'vitest'

import {
  buildSitemap,
  buildVaultMarkdown,
  buildVaultsMarkdown,
  formatFeePct,
  getVaultMarkdownListKind,
  type TVaultListEntry
} from './aio'

function address(seed: number): string {
  return `0x${seed.toString(16).padStart(40, '0')}`
}

describe('buildSitemap', () => {
  it('uses the same public catalog eligibility as the Markdown index', () => {
    const eligible = vault({ address: address(1), name: 'Eligible' })
    const sitemap = buildSitemap([
      eligible,
      vault({ address: address(2), name: 'Partner', origin: 'partner' }),
      vault({ address: address(3), name: 'Hidden', isHidden: true }),
      vault({ address: address(4), name: 'Retired', isRetired: true }),
      vault({ address: address(5), name: 'Strategy', kind: 'Single Strategy' }),
      vault({ address: address(6), name: 'Legacy', apiVersion: '2.0.0', v3: false, kind: 'Legacy' })
    ])

    expect(sitemap).toContain(`<loc>https://yearn.fi/vaults/1/${eligible.address}</loc>`)
    expect(sitemap).not.toContain(address(2))
    expect(sitemap).not.toContain(address(3))
    expect(sitemap).not.toContain(address(4))
    expect(sitemap).not.toContain(address(5))
    expect(sitemap).not.toContain(address(6))
  })

  it('includes status but omits fabricated and ignored sitemap metadata', () => {
    const sitemap = buildSitemap([vault({ address: address(1) })])

    expect(sitemap).toContain('<loc>https://yearn.fi/status</loc>')
    expect(sitemap).not.toContain('<lastmod>')
    expect(sitemap).not.toContain('<changefreq>')
    expect(sitemap).not.toContain('<priority>')
  })

  it('uses only a valid explicit upstream modification timestamp', () => {
    const sitemap = buildSitemap([
      vault({ address: address(1), updatedAt: 1_788_265_211 }),
      vault({ address: address(2), updatedAt: 'not-a-date' })
    ])

    expect(sitemap).toContain('<lastmod>2026-09-01T12:20:11.000Z</lastmod>')
    expect(sitemap.match(/<lastmod>/g)).toHaveLength(1)
  })

  it('skips unsafe identities and deduplicates vault URLs', () => {
    const duplicate = vault({ address: address(1) })
    const sitemap = buildSitemap([duplicate, { ...duplicate }, vault({ address: 'not-an-address' })])

    expect(sitemap.match(new RegExp(address(1), 'g'))).toHaveLength(1)
    expect(sitemap).not.toContain('not-an-address')
  })
})

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

  it('distinguishes document generation from upstream source freshness', () => {
    const markdown = buildVaultsMarkdown([vault({})], undefined, {
      generatedAt: '2026-09-01T15:00:00.000Z',
      sourceUpdatedAt: 1_788_265_211
    })

    expect(markdown).toContain('generated_at: 2026-09-01T15:00:00.000Z')
    expect(markdown).toContain('source_updated_at: 2026-09-01T12:20:11.000Z')
    expect(markdown).not.toMatch(/^updated:/m)
  })
})

describe('buildVaultMarkdown', () => {
  it('formats decimal and basis-point fee values as percentages', () => {
    expect(formatFeePct(0.1)).toBe('10.00%')
    expect(formatFeePct(1_000)).toBe('10.00%')

    const markdown = buildVaultMarkdown(
      {
        name: 'USDC Vault',
        symbol: 'yvUSDC',
        asset: { name: 'USD Coin', symbol: 'USDC', address: address(10) },
        tvl: { close: 1_000_000 },
        apy: { net: 0.03 },
        fees: { performanceFee: 1_000, managementFee: 0 }
      },
      1,
      address(11),
      { generatedAt: '2026-09-01T15:00:00.000Z' }
    )

    expect(markdown).toContain('| Performance | 10.00% |')
    expect(markdown).toContain('| Management | 0.00% |')
    expect(markdown).toContain('generated_at: 2026-09-01T15:00:00.000Z')
    expect(markdown).not.toContain('source_updated_at:')
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
