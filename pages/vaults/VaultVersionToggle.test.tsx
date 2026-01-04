import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { VaultVersionToggle } from './VaultVersionToggle'

function renderToggle(entry: string, showStrategies = false): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[entry]}>
      <VaultVersionToggle showStrategies={showStrategies} />
    </MemoryRouter>
  )
}

describe('VaultVersionToggle', () => {
  it('marks allocator vaults active when no type param', () => {
    const html = renderToggle('/vaults')
    expect(html).toMatch(/data-active="true".*Allocator Vaults/)
    expect(html).toMatch(/data-active="false".*Factory Vaults/)
    expect(html).not.toMatch(/v3 Strategies/)
    expect(html).toContain('⚙️')
    expect(html).toContain('🏭')
  })

  it('marks factory vaults active when type=factory', () => {
    const html = renderToggle('/vaults?type=factory')
    expect(html).toMatch(/data-active="true".*Factory Vaults/)
    expect(html).toMatch(/data-active="false".*Allocator Vaults/)
    expect(html).toContain('⚙️')
    expect(html).toContain('🏭')
  })

  it('shows v3 strategies tab when strategies are enabled', () => {
    const html = renderToggle('/vaults?types=single', true)
    expect(html).toMatch(/v3 Strategies/)
    expect(html).toMatch(/data-active="true".*v3 Strategies/)
  })

  it('falls back to allocator when strategies tab is hidden', () => {
    const html = renderToggle('/vaults?types=single', false)
    expect(html).toMatch(/data-active="true".*Allocator Vaults/)
    expect(html).not.toMatch(/v3 Strategies/)
  })
})
