import { VaultsCatalogIntro } from '@pages/vaults/components/VaultsCatalogIntro'
import { buildVaultDirectoryEntries } from '@pages/vaults/utils/vaultsDirectory'
import { buildVaultsInitialPayload } from '@pages/vaults/utils/vaultsInitialPayload'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { renderToStaticMarkup } from 'react-dom/server'
import { zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'

const ETHEREUM_VAULT_LOW = '0x1111111111111111111111111111111111111111'
const ETHEREUM_VAULT_HIGH = '0x2222222222222222222222222222222222222222'
const BASE_VAULT = '0x3333333333333333333333333333333333333333'
const HIDDEN_VAULT = '0x4444444444444444444444444444444444444444'
const ASSET_ADDRESS = '0x5555555555555555555555555555555555555555'
const STRATEGY_VAULT = '0x6666666666666666666666666666666666666666'
const LEGACY_VAULT = '0x7777777777777777777777777777777777777777'

function makeVault(overrides: Partial<TKongVaultListItem> = {}): TKongVaultListItem {
  return {
    chainId: 1,
    address: ETHEREUM_VAULT_LOW,
    name: 'Ethereum Starter Vault',
    symbol: 'yvSTART',
    apiVersion: '3.0.4',
    decimals: 18,
    asset: {
      address: ASSET_ADDRESS,
      name: 'Starter Token',
      symbol: 'START',
      decimals: 18
    },
    tvl: 100,
    performance: {
      oracle: { apr: 0.03, apy: 0.031, netAPR: 0.03, netAPY: 0.031 },
      estimated: { apr: 0.03, apy: 0.031, type: 'estimated', components: {} },
      historical: { net: 0.03, weeklyNet: 0.03, monthlyNet: 0.03, inceptionNet: 0.03 }
    },
    fees: { managementFee: 0, performanceFee: 1000 },
    category: 'Stablecoin',
    type: 'Standard',
    kind: 'Multi Strategy',
    v3: true,
    yearn: true,
    isRetired: false,
    isHidden: false,
    isBoosted: false,
    isHighlighted: false,
    inclusion: { isYearn: true },
    migration: false,
    origin: 'yearn',
    strategiesCount: 1,
    riskLevel: 2,
    staking: { address: zeroAddress, available: false, source: '', rewards: [] },
    pricePerShare: '1000000000000000000',
    ...overrides
  } as TKongVaultListItem
}

const initialVaults = buildVaultsInitialPayload([
  makeVault(),
  makeVault({
    address: ETHEREUM_VAULT_HIGH,
    name: 'Ethereum Core Vault',
    symbol: 'yvCORE',
    tvl: 200
  }),
  makeVault({
    address: BASE_VAULT,
    chainId: 8453,
    name: 'Base Vault',
    symbol: 'yvBASE',
    tvl: 50
  }),
  makeVault({
    address: HIDDEN_VAULT,
    name: 'Hidden Vault',
    isHidden: true,
    tvl: 1_000
  }),
  makeVault({
    address: STRATEGY_VAULT,
    name: 'Underlying Strategy',
    kind: 'Single Strategy',
    tvl: 900
  }),
  makeVault({
    address: LEGACY_VAULT,
    name: 'Legacy Vault',
    apiVersion: '0.4.3',
    kind: 'Legacy',
    v3: false,
    tvl: 800
  })
])

describe('VaultsCatalogIntro', () => {
  it('selects public vaults across networks before filling from the remaining catalog', () => {
    const entries = buildVaultDirectoryEntries(initialVaults, 3)

    expect(entries.map((entry) => entry.name)).toEqual(['Ethereum Core Vault', 'Base Vault', 'Ethereum Starter Vault'])
    expect(entries.some((entry) => entry.name === 'Hidden Vault')).toBe(false)
    expect(entries.some((entry) => entry.name === 'Underlying Strategy')).toBe(false)
    expect(entries.some((entry) => entry.name === 'Legacy Vault')).toBe(false)
  })

  it('renders semantic vault links and matching ItemList data in server HTML', () => {
    const html = renderToStaticMarkup(<VaultsCatalogIntro initialVaults={initialVaults} />)

    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html.indexOf('aria-label="Breadcrumb"')).toBeLessThan(html.indexOf('<h1 id="vaults-heading"'))
    expect(html).toContain('<h1 id="vaults-heading"')
    expect(html).toContain('Explore active Yearn vaults across supported networks')
    expect(html).toContain('href="/api/vaults/markdown"')
    expect(html).toContain(`href="/vaults/1/${ETHEREUM_VAULT_HIGH}"`)
    expect(html).toContain(`href="/vaults/8453/${BASE_VAULT}"`)
    expect(html).not.toContain('Hidden Vault')
    expect(html).not.toContain('Underlying Strategy')
    expect(html).not.toContain('Legacy Vault')
    expect(html).toContain('"@type":"ItemList"')
    expect(html).toContain('"numberOfItems":3')
  })
})
