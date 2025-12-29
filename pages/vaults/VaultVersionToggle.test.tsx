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
    expect(html).toMatch(/data-active="true".*Allocator Vaults/)
    expect(html).toMatch(/data-active="false".*Factory Vaults/)
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
})
