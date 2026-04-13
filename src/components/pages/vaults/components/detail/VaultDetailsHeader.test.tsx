import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { VaultDetailsHeaderPresentation } from './VaultDetailsHeader'

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({
    address: undefined,
    isActive: false
  })
}))

vi.mock('@shared/contexts/useYearn', () => ({
  useYearn: () => ({
    getPrice: () => ({
      normalized: 1
    })
  })
}))

vi.mock('@pages/vaults/hooks/useVaultUserData', () => ({
  useVaultUserData: () => ({
    depositedValue: 0n,
    assetToken: {
      decimals: 18,
      symbol: 'yvUSD'
    },
    vaultToken: {
      symbol: 'yvUSD'
    }
  })
}))

vi.mock('@pages/vaults/hooks/useYvUsdVaults', () => ({
  useYvUsdVaults: () => ({
    metrics: undefined,
    unlockedVault: {
      address: YVUSD_UNLOCKED_ADDRESS,
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'USDC',
        decimals: 6
      },
      tvl: {
        price: 1,
        tvl: 100
      },
      apr: {
        forwardAPR: {
          netAPR: 0.05
        },
        points: {
          monthAgo: 0.04,
          weekAgo: 0.03
        }
      }
    },
    lockedVault: {
      address: YVUSD_LOCKED_ADDRESS,
      token: {
        address: YVUSD_UNLOCKED_ADDRESS,
        symbol: 'yvUSD',
        decimals: 18
      },
      tvl: {
        price: 1,
        tvl: 50
      },
      apr: {
        forwardAPR: {
          netAPR: 0.06
        },
        points: {
          monthAgo: 0.05,
          weekAgo: 0.04
        }
      }
    }
  })
}))

vi.mock('@shared/components/MetricsCard', () => ({
  METRIC_FOOTNOTE_CLASS: 'metric-footnote',
  METRIC_VALUE_CLASS: 'metric-value',
  MetricHeader: ({ label }: { label: string }) => <span>{label}</span>,
  MetricsCard: ({
    items,
    className
  }: {
    items: Array<{ key: string; header: ReactNode; value: ReactNode; footnote?: ReactNode }>
    className?: string
  }) => (
    <div className={className}>
      {items.map((item) => (
        <div key={item.key}>
          {item.header}
          {item.value}
          {item.footnote}
        </div>
      ))}
    </div>
  )
}))

vi.mock('@pages/vaults/components/table/VaultForwardAPY', () => ({
  VaultForwardAPY: () => <div>{'Forward APY'}</div>
}))

vi.mock('@pages/vaults/components/table/VaultHistoricalAPY', () => ({
  VaultHistoricalAPY: () => <div>{'Historical APY'}</div>
}))

vi.mock('@pages/vaults/components/table/VaultTVL', () => ({
  VaultTVL: () => <div>{'TVL'}</div>
}))

vi.mock('@pages/vaults/components/widget', () => ({
  WidgetTabs: () => <div>{'Widget Tabs'}</div>
}))

vi.mock('@pages/vaults/components/yvUSD/YvUsdBreakdown', () => ({
  YvUsdApyTooltipContent: () => <div>{'yvUSD APY tooltip'}</div>,
  YvUsdTvlTooltipContent: () => <div>{'yvUSD TVL tooltip'}</div>
}))

vi.mock('@pages/vaults/components/yvUSD/YvUsdHeaderBanner', () => ({
  YvUsdHeaderBanner: () => <div>{'yvUSD banner'}</div>
}))

const YVUSD_VAULT = {
  version: '3.0.4',
  address: YVUSD_UNLOCKED_ADDRESS,
  chainID: 1,
  type: 'Automated Yearn Vault',
  kind: 'Multi Strategy',
  symbol: 'yvUSD',
  name: 'yvUSD',
  description: '',
  category: 'Stablecoin',
  decimals: 18,
  token: {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6
  },
  tvl: {
    tvl: 150,
    totalAssets: 150000000000000000000n,
    price: 1
  },
  apr: {
    netAPR: 0.05,
    forwardAPR: {
      netAPR: 0.05
    },
    points: {
      monthAgo: 0.04,
      weekAgo: 0.03
    }
  },
  strategies: [],
  staking: {
    address: '0x0000000000000000000000000000000000000000',
    available: false,
    source: '',
    rewards: []
  },
  migration: {
    available: false,
    address: '0x0000000000000000000000000000000000000000',
    contract: '0x0000000000000000000000000000000000000000'
  },
  info: {
    riskLevel: 2,
    riskScore: {},
    riskScoreComment: '',
    sourceURL: '',
    uiNotice: '',
    isRetired: false,
    isBoosted: false,
    isHighlighted: false,
    isHidden: false
  }
} as const

describe('VaultDetailsHeaderPresentation', () => {
  it('uses the standard compressed token logo size for yvUSD', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <VaultDetailsHeaderPresentation currentVault={YVUSD_VAULT as never} depositedValue={0n} isCompressed={true} />
      </MemoryRouter>
    )

    expect(html).toContain('style="width:32px;height:32px"')
    expect(html).not.toContain('style="width:40px;height:40px"')
    expect(html).toContain('size-8')
  })

  it('keeps the explorer link visible when header is compressed', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <VaultDetailsHeaderPresentation currentVault={YVUSD_VAULT as never} depositedValue={0n} isCompressed={true} />
      </MemoryRouter>
    )

    expect(html).toContain('View vault on block explorer')
    expect(html).toContain('/address/')
  })
})
