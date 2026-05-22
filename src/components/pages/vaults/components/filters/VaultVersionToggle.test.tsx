import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { VaultVersionToggle } from './VaultVersionToggle'

const { mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSearchParams: vi.fn(() => new URLSearchParams())
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/vaults',
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => mockSearchParams()
}))

function renderToggle(entry: string): string {
  const url = new URL(entry, 'https://yearn.fi')
  mockSearchParams.mockReturnValue(new URLSearchParams(url.search))
  return renderToStaticMarkup(<VaultVersionToggle />)
}

describe('VaultVersionToggle', () => {
  it('marks all vaults active when no type param', () => {
    const html = renderToggle('/vaults')
    expect(html).toMatch(/data-active="true".*All Vaults/)
    expect(html).toMatch(/data-active="false".*Single Asset/)
    expect(html).toMatch(/data-active="false".*LP Token/)
    expect(html).not.toMatch(/v3 Strategies/)
  })

  it('marks lp token vaults active when type=lp', () => {
    const html = renderToggle('/vaults?type=lp')
    expect(html).toMatch(/data-active="true".*LP Token/)
    expect(html).toMatch(/data-active="false".*Single Asset/)
    expect(html).toMatch(/data-active="false".*All Vaults/)
  })

  it('marks single asset vaults active when type=single', () => {
    const html = renderToggle('/vaults?type=single')
    expect(html).toMatch(/data-active="false".*All Vaults/)
    expect(html).toMatch(/data-active="true".*Single Asset/)
    expect(html).toMatch(/data-active="false".*LP Token/)
  })
})
