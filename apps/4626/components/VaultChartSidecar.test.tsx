// @vitest-environment jsdom
import { VaultChartSidecar } from '@erc4626/components/VaultChartSidecar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { VaultWidgetVault } from '@yearn/vault-widget/types'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@yearn/vault-widget/internal/components/shared/TokenLogoV2', () => ({ TokenLogoV2: () => null }))
const vault: VaultWidgetVault = {
  chainId: 1,
  address: '0x1111111111111111111111111111111111111111',
  decimals: 18,
  name: 'Example vault',
  symbol: 'yvTOKEN',
  isRetired: false,
  asset: { address: '0x2222222222222222222222222222222222222222', decimals: 6, symbol: 'TOKEN', name: 'Token' }
}
const today = Math.floor(Date.now() / 86400000) * 86400
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('loads only when opened and supports metrics, periods and keyboard inspection', async () => {
  const fetcher = vi.fn(async (url: URL) =>
    Response.json([
      { time: today - 86400, value: String(url.pathname.includes('apy-historical') ? 0.04 : 1.02) },
      { time: today, value: String(url.pathname.includes('apy-historical') ? 0.05 : 1.05) }
    ])
  )
  vi.stubGlobal('fetch', fetcher)
  const client = new QueryClient()
  const widget = (enabled: boolean) => (
    <QueryClientProvider client={client}>
      <VaultChartSidecar vault={vault} enabled={enabled} onClose={() => undefined} />
    </QueryClientProvider>
  )
  const view = render(widget(false))
  const link = screen.getByRole('link', { name: 'Open vault in Powerglove' })
  expect(link.getAttribute('href')).toBe(`https://powerglove.yearn.fi/vaults/${vault.chainId}/${vault.address}`)
  expect(link.getAttribute('target')).toBe('_blank')
  expect(fetcher).not.toHaveBeenCalled()
  view.rerender(widget(true))
  await screen.findByRole('slider', { name: 'Explore share value history' })
  expect(document.querySelector('[data-chart-value]')?.textContent).toBe('1.05 TOKEN')
  fireEvent.click(screen.getByRole('button', { name: '30-day APY' }))
  const slider = await screen.findByRole('slider', { name: 'Explore 30-day apy history' })
  expect(document.querySelector('[data-chart-value]')?.textContent).toBe('5%')
  fireEvent.keyDown(slider, { key: 'Home' })
  expect(document.querySelector('[data-chart-value]')?.textContent).toBe('4%')
  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  expect(document.querySelector('[data-chart-value]')?.textContent).toBe('5%')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('shows unavailable history without inventing observations and closes on Escape', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 404 }))
  )
  const close = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VaultChartSidecar enabled vault={vault} onClose={close} />
    </QueryClientProvider>
  )
  await screen.findByText('No indexed history is available for this vault yet.')
  expect(screen.queryByRole('slider')).toBeNull()
  fireEvent.keyDown(screen.getByRole('region', { name: 'Vault history' }), { key: 'Escape' })
  expect(close).toHaveBeenCalledOnce()
})
it('shows a retryable failure separately from empty history', async () => {
  const fetcher = vi.fn(async () => new Response('', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VaultChartSidecar enabled vault={vault} onClose={() => undefined} />
    </QueryClientProvider>
  )
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be loaded'), { timeout: 4000 })
  fetcher.mockImplementation(async () => Response.json([{ time: today, value: '1.02' }]))
  fireEvent.click(screen.getByRole('button', { name: 'Retry history' }))
  await screen.findByRole('slider')
  expect(document.querySelector('[data-chart-value]')?.textContent).toBe('1.02 TOKEN')
})
