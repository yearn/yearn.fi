import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import VaultsListRowExpandedContent from './VaultsListRowExpandedContent'

const { snapshot } = vi.hoisted(() => ({
  snapshot: {
    address: '0x1111111111111111111111111111111111111111',
    chainId: 1,
    totalAssets: '100000000',
    tvl: { close: 250 },
    composition: [
      {
        address: '0x2222222222222222222222222222222222222222',
        name: 'Snapshot Strategy',
        status: 'active',
        totalDebt: '75000000'
      }
    ]
  }
}))

vi.mock('@hooks/usePlausible', () => ({
  usePlausible: () => vi.fn()
}))

vi.mock('@pages/vaults/hooks/useVaultSnapshot', () => ({
  useVaultSnapshot: () => ({ data: snapshot })
}))

vi.mock('@pages/vaults/hooks/useVaultApyData', () => ({
  useVaultApyData: () => undefined
}))

vi.mock('@pages/vaults/components/table/apyDisplayConfig', () => ({
  resolveForwardApyDisplayConfig: () => ({ displayConfig: {} })
}))

vi.mock('@pages/vaults/components/detail/VaultAboutSection', () => ({
  VaultAboutSection: () => <div>{'About'}</div>
}))

vi.mock('@shared/contexts/useYearn', () => ({
  useYearn: () => ({ vaults: {} })
}))

vi.mock('@shared/components/AllocationChart', () => ({
  AllocationChart: ({ allocationChartData }: { allocationChartData: unknown }) => (
    <div>{JSON.stringify(allocationChartData)}</div>
  ),
  DARK_MODE_COLORS: ['#000'],
  LIGHT_MODE_COLORS: ['#fff'],
  useDarkMode: () => false
}))

const COMPACT_SSR_VAULT = {
  address: '0x1111111111111111111111111111111111111111',
  version: '3.0.0',
  type: 'Standard',
  kind: 'Multi Strategy',
  symbol: 'yvTEST',
  name: 'Test Vault',
  description: '',
  category: 'Stablecoin',
  decimals: 6,
  chainID: 1,
  token: {
    address: '0x3333333333333333333333333333333333333333',
    name: 'Test Token',
    symbol: 'TEST',
    description: '',
    decimals: 6
  },
  tvl: {
    totalAssets: 0n,
    tvl: 200,
    price: 0
  },
  strategies: [],
  staking: {
    address: '0x0000000000000000000000000000000000000000',
    available: false,
    source: '',
    rewards: null
  }
} as unknown as TKongVaultInput

describe('VaultsListRowExpandedContent', () => {
  it('renders snapshot allocation and unallocated TVL for an anonymous compact SSR row', () => {
    const html = renderToStaticMarkup(
      <VaultsListRowExpandedContent
        currentVault={COMPACT_SSR_VAULT}
        expandedView={'strategies'}
        onExpandedViewChange={vi.fn()}
        onNavigateToVault={vi.fn()}
      />
    )

    expect(html).toContain('Snapshot Strategy')
    expect(html).toContain('&quot;value&quot;:75')
    expect(html).toContain('&quot;name&quot;:&quot;Unallocated&quot;')
    expect(html).toContain('&quot;value&quot;:25')
    expect(html).not.toContain('No strategy allocation data available.')
  })
})
