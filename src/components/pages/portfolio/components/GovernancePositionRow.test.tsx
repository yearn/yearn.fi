import { YVUSDC_REWARD_ADDRESS } from '@pages/portfolio/governance/constants'
import type { TGovernancePosition } from '@pages/portfolio/governance/types'
import { toAddress } from '@shared/utils'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GovernancePositionRow } from './GovernancePositionRow'

const buildPosition = (overrides: Partial<TGovernancePosition> = {}): TGovernancePosition => ({
  id: 'governance-styfi',
  kind: 'styfi',
  name: 'Staked YFI',
  symbol: 'stYFI',
  subtitle: 'Governance staking',
  href: 'https://styfi.yearn.fi',
  tokenAddress: toAddress('0x42b25284E8ae427D79da78b65DFFC232aAECc016'),
  amountRaw: 3n * 10n ** 18n,
  amountNormalized: 3,
  amountYfiRaw: 3n * 10n ** 18n,
  amountYfiNormalized: 3,
  activeRaw: 1n * 10n ** 18n,
  cooldownRaw: 1n * 10n ** 18n,
  withdrawableRaw: 1n * 10n ** 18n,
  walletRaw: 0n,
  valueUsd: 30_000,
  tvlYfiRaw: 100n * 10n ** 18n,
  tvlYfiNormalized: 100,
  tvlUsd: 1_000_000,
  apy: 0.08,
  cooldown: {
    amountRaw: 1n * 10n ** 18n,
    totalRaw: 1n * 10n ** 18n,
    endsAt: 1_900_000_000
  },
  reward: {
    amountRaw: 2n * 10n ** 18n,
    tokenAddress: YVUSDC_REWARD_ADDRESS,
    symbol: 'yvUSDC',
    amountNormalized: 2,
    usdValue: 2.5
  },
  ...overrides
})

describe('GovernancePositionRow', () => {
  it('renders governance metrics and actionable status chips without descriptor or reward chips', () => {
    const html = renderToStaticMarkup(<GovernancePositionRow position={buildPosition()} />)

    expect(html).toContain('Staked YFI')
    expect(html).toContain('Est. APY:')
    expect(html).toContain('8.00%')
    expect(html).toContain('Holdings:')
    expect(html).toContain('$30.0K')
    expect(html).toContain('$1.00M')
    expect(html).not.toContain('100 YFI TVL')
    expect(html).not.toContain('3 YFI eq.')
    expect(html).toContain('Cooldown')
    expect(html).toContain('Withdrawable')
    expect(html).not.toContain('Governance staking')
    expect(html).not.toContain('Rewards 2 yvUSDC')
    expect(html).toContain('https://styfi.yearn.fi')
  })

  it('renders unavailable APY as a dash', () => {
    const html = renderToStaticMarkup(<GovernancePositionRow position={buildPosition({ apy: null })} />)

    expect(html).toContain('>-</span>')
  })
})
