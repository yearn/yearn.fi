// @vitest-environment jsdom

import { TranchedVaultBanner } from '@pages/vaults/components/tranched/TranchedVaultBanner'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(cleanup)

it.each(['senior', 'junior'] as const)('shows the %s banner and opens the structure', (kind) => {
  const onExploreStructure = vi.fn()
  const label = kind === 'senior' ? 'Senior' : 'Junior'
  render(<TranchedVaultBanner kind={kind} onExploreStructure={onExploreStructure} />)
  expect(screen.getByText(`${label}, by Yearn.`)).toBeTruthy()
  expect(screen.getByRole('complementary', { name: `${label} tranche banner` }).style.backgroundImage).toContain(
    `ytranche/${kind}-banner.png`
  )
  fireEvent.click(screen.getByRole('button', { name: 'Explore the structure' }))
  expect(onExploreStructure).toHaveBeenCalledOnce()
})
