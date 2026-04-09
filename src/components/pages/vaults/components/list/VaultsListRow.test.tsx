import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VaultsListRow } from './VaultsListRow'

const { mockUseMediaQuery, mockUseYvUsdVaults } = vi.hoisted(() => ({
  mockUseMediaQuery: vi.fn(() => false),
  mockUseYvUsdVaults: vi.fn((): any => ({
    metrics: undefined,
    unlockedVault: undefined,
    lockedVault: undefined
  }))
}))

vi.mock('@react-hookz/web', () => ({
  useMediaQuery: mockUseMediaQuery
}))

vi.mock('@shared/contexts/useWallet', () => ({
  useWallet: () => ({
    getBalance: () => ({ raw: 0n, normalized: 0 }),
    getToken: () => ({ value: 0 })
  })
}))

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({
    address: undefined
  })
}))

vi.mock('@hooks/usePlausible', () => ({
  usePlausible: () => vi.fn()
}))

vi.mock('@pages/vaults/hooks/useYvUsdVaults', () => ({
  useYvUsdVaults: mockUseYvUsdVaults
}))

vi.mock('@pages/vaults/components/table/VaultForwardAPY', () => ({
  VaultForwardAPY: () => <div>{'APY'}</div>,
  VaultForwardAPYInlineDetails: () => <div>{'APY details'}</div>
}))

vi.mock('@pages/vaults/components/table/VaultHistoricalAPY', () => ({
  VaultHistoricalAPY: () => <div>{'Historical APY'}</div>
}))

vi.mock('@pages/vaults/components/table/VaultHoldingsAmount', () => ({
  VaultHoldingsAmount: () => <div>{'Holdings'}</div>
}))

vi.mock('@pages/vaults/components/table/VaultRiskScoreTag', () => ({
  VaultRiskScoreTag: () => <div>{'Risk'}</div>,
  RiskScoreInlineDetails: () => <div>{'Risk details'}</div>
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn()
  })
}))

function renderRowHtml(vault: TKongVaultInput): string {
  const queryClient = new QueryClient()

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <VaultsListRow currentVault={vault} />
    </QueryClientProvider>
  )
}

describe('VaultsListRow', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(false)
    mockUseYvUsdVaults.mockReturnValue({
      metrics: undefined,
      unlockedVault: undefined,
      lockedVault: undefined
    })
  })

  it('renders the desktop TVL tooltip trigger for standard vault rows', () => {
    const vault = {
      version: '3.0.0',
      chainID: 1,
      address: '0x0000000000000000000000000000000000000001',
      name: 'Test Vault',
      category: 'Test Category',
      kind: 'Multi Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'TKN',
        decimals: 6
      },
      tvl: {
        tvl: 1234,
        totalAssets: 1234567
      },
      info: {
        riskLevel: 3
      }
    } as unknown as TKongVaultInput

    const html = renderRowHtml(vault)

    expect(html).toContain('tvl-subline-tooltip')
  })

  it('stacks the yvUSD mobile up-to label above the APY value', () => {
    mockUseMediaQuery.mockReturnValue(true)
    mockUseYvUsdVaults.mockReturnValue({
      metrics: {
        unlocked: { apy: 0.05, tvl: 100, hasInfinifiPoints: false },
        locked: { apy: 0.09, tvl: 250, hasInfinifiPoints: false }
      },
      unlockedVault: undefined,
      lockedVault: undefined
    })

    const vault = {
      version: '3.0.0',
      chainID: 1,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      symbol: 'yvUSD',
      category: 'Stablecoin',
      kind: 'Multi Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'USDC',
        decimals: 6
      },
      apr: {
        forwardAPR: {
          netAPR: 0.05
        },
        netAPR: 0.05
      },
      tvl: {
        tvl: 350,
        totalAssets: 350_000_000
      },
      info: {
        riskLevel: 2
      },
      staking: {
        address: '0x0000000000000000000000000000000000000000'
      }
    } as unknown as TKongVaultInput

    const html = renderRowHtml(vault)

    expect(html).toContain('Up to')
    expect(html).toContain('9.00%')
    expect(html).toContain('inline-flex flex-col items-start')
  })

  it('formats yvUSD locked APY with shared significant-digit rounding in the list row', () => {
    mockUseMediaQuery.mockReturnValue(true)
    mockUseYvUsdVaults.mockReturnValue({
      metrics: {
        unlocked: { apy: 0.05, tvl: 100, hasInfinifiPoints: false },
        locked: { apy: 1.1777, tvl: 250, hasInfinifiPoints: false }
      },
      unlockedVault: undefined,
      lockedVault: undefined
    })

    const vault = {
      version: '3.0.0',
      chainID: 1,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      symbol: 'yvUSD',
      category: 'Stablecoin',
      kind: 'Multi Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'USDC',
        decimals: 6
      },
      apr: {
        forwardAPR: {
          netAPR: 0.05
        },
        netAPR: 0.05
      },
      tvl: {
        tvl: 350,
        totalAssets: 350_000_000
      },
      info: {
        riskLevel: 2
      },
      staking: {
        address: '0x0000000000000000000000000000000000000000'
      }
    } as unknown as TKongVaultInput

    const html = renderRowHtml(vault)

    expect(html).toContain('118%')
    expect(html).not.toContain('117.77%')
    expect(html).toContain('flex items-center justify-center gap-2 whitespace-nowrap')
  })

  it('positions the desktop yvUSD up-to label above the APY value without changing row flow', () => {
    mockUseMediaQuery.mockReturnValue(false)
    mockUseYvUsdVaults.mockReturnValue({
      metrics: {
        unlocked: { apy: 0.05, tvl: 100, hasInfinifiPoints: false },
        locked: { apy: 0.09, tvl: 250, hasInfinifiPoints: false }
      },
      unlockedVault: undefined,
      lockedVault: undefined
    })

    const vault = {
      version: '3.0.0',
      chainID: 1,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      symbol: 'yvUSD',
      category: 'Stablecoin',
      kind: 'Multi Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'USDC',
        decimals: 6
      },
      apr: {
        forwardAPR: {
          netAPR: 0.05
        },
        netAPR: 0.05
      },
      tvl: {
        tvl: 350,
        totalAssets: 350_000_000
      },
      info: {
        riskLevel: 2
      },
      staking: {
        address: '0x0000000000000000000000000000000000000000'
      }
    } as unknown as TKongVaultInput

    const html = renderRowHtml(vault)

    expect(html).toContain('inline-flex items-center gap-2 text-right')
    expect(html).toContain('relative inline-flex')
    expect(html).toContain('absolute bottom-full left-0 mb-0.5')
  })

  it('shows the Infinifi points icon for yvUSD when either variant has points', () => {
    mockUseYvUsdVaults.mockReturnValue({
      metrics: {
        unlocked: { apy: 0.05, tvl: 100, hasInfinifiPoints: false },
        locked: { apy: 0.09, tvl: 250, hasInfinifiPoints: true }
      },
      unlockedVault: undefined,
      lockedVault: undefined
    })

    const vault = {
      version: '3.0.0',
      chainID: 1,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      symbol: 'yvUSD',
      category: 'Stablecoin',
      kind: 'Multi Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'USDC',
        decimals: 6
      },
      apr: {
        forwardAPR: {
          netAPR: 0.05
        },
        netAPR: 0.05
      },
      tvl: {
        tvl: 350,
        totalAssets: 350_000_000
      },
      info: {
        riskLevel: 2
      },
      staking: {
        address: '0x0000000000000000000000000000000000000000'
      }
    } as unknown as TKongVaultInput

    const html = renderRowHtml(vault)

    expect(html).toContain('aria-label="Infinifi points"')
  })

  it('does not show the Infinifi points icon for yvUSD without points', () => {
    mockUseYvUsdVaults.mockReturnValue({
      metrics: {
        unlocked: { apy: 0.05, tvl: 100, hasInfinifiPoints: false },
        locked: { apy: 0.09, tvl: 250, hasInfinifiPoints: false }
      },
      unlockedVault: undefined,
      lockedVault: undefined
    })

    const vault = {
      version: '3.0.0',
      chainID: 1,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      symbol: 'yvUSD',
      category: 'Stablecoin',
      kind: 'Multi Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'USDC',
        decimals: 6
      },
      apr: {
        forwardAPR: {
          netAPR: 0.05
        },
        netAPR: 0.05
      },
      tvl: {
        tvl: 350,
        totalAssets: 350_000_000
      },
      info: {
        riskLevel: 2
      },
      staking: {
        address: '0x0000000000000000000000000000000000000000'
      }
    } as unknown as TKongVaultInput

    const html = renderRowHtml(vault)

    expect(html).not.toContain('aria-label="Infinifi points"')
  })

  it('does not show the Infinifi points icon for non-yvUSD rows', () => {
    mockUseYvUsdVaults.mockReturnValue({
      metrics: {
        unlocked: { apy: 0.05, tvl: 100, hasInfinifiPoints: true },
        locked: { apy: 0.09, tvl: 250, hasInfinifiPoints: true }
      },
      unlockedVault: undefined,
      lockedVault: undefined
    })

    const vault = {
      version: '3.0.0',
      chainID: 1,
      address: '0x0000000000000000000000000000000000000001',
      name: 'Test Vault',
      category: 'Test Category',
      kind: 'Multi Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        symbol: 'TKN',
        decimals: 6
      },
      tvl: {
        tvl: 1234,
        totalAssets: 1234567
      },
      info: {
        riskLevel: 3
      }
    } as unknown as TKongVaultInput

    const html = renderRowHtml(vault)

    expect(html).not.toContain('aria-label="Infinifi points"')
  })
})
