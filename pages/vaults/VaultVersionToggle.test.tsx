import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { VaultVersionToggle } from './VaultVersionToggle'

function renderToggle(entry: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[entry]}>
      <VaultVersionToggle />
    </MemoryRouter>
  )
}

describe('VaultVersionToggle', () => {
  it('marks allocator vaults active when no type param', () => {
    const html = renderToggle('/vaults')
    expect(html).toMatch(/data-active="false".*All Vaults/)
    expect(html).toMatch(/data-active="true".*Single Asset Vaults/)
    expect(html).toMatch(/data-active="false".*LP Vaults/)
    expect(html).not.toMatch(/v3 Strategies/)
    expect(html).toContain('🌐')
    expect(html).toContain('⚙️')
    expect(html).toContain('🏭')
  })

  it('marks LP vaults active when type=factory', () => {
    const html = renderToggle('/vaults?type=factory')
    expect(html).toMatch(/data-active="true".*LP Vaults/)
    expect(html).toMatch(/data-active="false".*Single Asset Vaults/)
    expect(html).toMatch(/data-active="false".*All Vaults/)
    expect(html).toContain('🌐')
    expect(html).toContain('⚙️')
    expect(html).toContain('🏭')
  })

  it('marks all vaults active when type=all', () => {
    const html = renderToggle('/vaults?type=all')
    expect(html).toMatch(/data-active="true".*All Vaults/)
    expect(html).toMatch(/data-active="false".*Single Asset Vaults/)
    expect(html).toMatch(/data-active="false".*LP Vaults/)
  })
})
