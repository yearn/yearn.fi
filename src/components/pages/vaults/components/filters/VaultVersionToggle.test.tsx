import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { VaultVersionToggle } from './VaultVersionToggle'

vi.mock('@hooks/usePlausible', () => ({
  usePlausible: () => vi.fn()
}))

function renderToggle(activeType?: 'all' | 'v3' | 'factory'): string {
  return renderToStaticMarkup(<VaultVersionToggle activeType={activeType} />)
}

describe('VaultVersionToggle', () => {
  it('marks all vaults active by default', () => {
    const html = renderToggle()
    expect(html).toMatch(/data-active="true".*All Vaults/)
    expect(html).toMatch(/data-active="false".*Single Asset/)
    expect(html).toMatch(/data-active="false".*LP Token/)
    expect(html).not.toMatch(/v3 Strategies/)
  })

  it('marks lp token vaults active when controlled active type is factory', () => {
    const html = renderToggle('factory')
    expect(html).toMatch(/data-active="true".*LP Token/)
    expect(html).toMatch(/data-active="false".*Single Asset/)
    expect(html).toMatch(/data-active="false".*All Vaults/)
  })

  it('marks single asset vaults active when controlled active type is v3', () => {
    const html = renderToggle('v3')
    expect(html).toMatch(/data-active="false".*All Vaults/)
    expect(html).toMatch(/data-active="true".*Single Asset/)
    expect(html).toMatch(/data-active="false".*LP Token/)
  })
})
