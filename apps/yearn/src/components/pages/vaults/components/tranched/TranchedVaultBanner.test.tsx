// @vitest-environment jsdom

import { TranchedVaultBanner } from '@pages/vaults/components/tranched/TranchedVaultBanner'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

afterEach(cleanup)

it.each([
  {
    asset: 'USD',
    kind: 'senior',
    name: 'yvUSD',
    apyLabel: '5.00%',
    heading: 'Still yvUSD, now Senior.',
    subheading: 'A 5% target APY with no withdrawal cooldown'
  },
  {
    asset: 'ETH',
    kind: 'senior',
    name: 'yvETH',
    apyLabel: '3.00%',
    heading: 'Meet yvETH Senior.',
    subheading: 'A 3% target APY with no withdrawal cooldown'
  },
  {
    asset: 'USD',
    kind: 'junior',
    name: 'yvUSD Junior',
    apyLabel: '9.13%',
    heading: 'Meet yvUSD Junior.',
    subheading: 'Higher yield potential with a 14-day withdrawal cooldown'
  },
  {
    asset: 'ETH',
    kind: 'junior',
    name: 'yvETH Junior',
    apyLabel: '13.35%',
    heading: 'Meet yvETH Junior.',
    subheading: 'Higher yield potential with a 14-day withdrawal cooldown'
  }
] as const)(
  'shows the $name banner with its expected content',
  ({ apyLabel, asset, kind, name, heading, subheading }) => {
    const label = kind === 'senior' ? 'Senior' : 'Junior'
    render(<TranchedVaultBanner apyLabel={apyLabel} asset={asset} kind={kind} name={name} />)
    expect(screen.getByText(heading)).toBeTruthy()
    expect(screen.getByText(subheading)).toBeTruthy()
    expect(screen.queryByText('Explore the structure')).toBeNull()
    expect(screen.getByRole('complementary', { name: `${label} tranche banner` }).style.backgroundImage).toContain(
      `ytranche/${kind}-banner.png`
    )
  }
)
