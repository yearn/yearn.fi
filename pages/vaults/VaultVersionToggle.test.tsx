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
  it('marks all vaults active when no type param', () => {
    const html = renderToggle('/vaults')
    expect(html).toMatch(/data-active="true".*All Vaults/)
    expect(html).toMatch(/data-active="false".*Single Asset/)
    expect(html).toMatch(/data-active="false".*LP Token/)
    expect(html).not.toMatch(/v3 Strategies/)
    expect(html).toContain('🌐')
    expect(html).toContain('⚙️')
    expect(html).toContain('🏭')
  })

  it('marks lp token vaults active when type=lp', () => {
    const html = renderToggle('/vaults?type=lp')
    expect(html).toMatch(/data-active="true".*LP Token/)
    expect(html).toMatch(/data-active="false".*Single Asset/)
    expect(html).toMatch(/data-active="false".*All Vaults/)
    expect(html).toContain('🌐')
    expect(html).toContain('⚙️')
    expect(html).toContain('🏭')
  })

  it('marks single asset vaults active when type=single', () => {
    const html = renderToggle('/vaults?type=single')
    expect(html).toMatch(/data-active="false".*All Vaults/)
    expect(html).toMatch(/data-active="true".*Single Asset/)
    expect(html).toMatch(/data-active="false".*LP Token/)
  })
})
