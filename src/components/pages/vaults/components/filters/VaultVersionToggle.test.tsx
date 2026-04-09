import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { VaultVersionToggle } from './VaultVersionToggle'

const { mockCurrentEntry } = vi.hoisted(() => ({
  mockCurrentEntry: { value: '/vaults' }
}))

vi.mock('next/navigation', () => ({
  usePathname: () => new URL(mockCurrentEntry.value, 'https://yearn.fi').pathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn()
  }),
  useSearchParams: () => new URL(mockCurrentEntry.value, 'https://yearn.fi').searchParams
}))

function renderToggle(entry: string): string {
  mockCurrentEntry.value = entry
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
