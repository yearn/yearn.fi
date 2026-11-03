import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { WalletQr } from '@yearn/wallet-ui/WalletQr'
import { afterEach, expect, it } from 'vitest'

afterEach(cleanup)

it('renders an encoded QR locally and removes the pairing from the query cache on close', async () => {
  const client = new QueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <WalletQr uri="wc:test@2?key=secret" />
    </QueryClientProvider>
  )
  const image = await screen.findByAltText('WalletConnect QR code')
  const src = image.getAttribute('src')!
  expect(src).toMatch(/^data:image\/svg\+xml,/)
  expect(decodeURIComponent(src.slice(src.indexOf(',') + 1))).toContain('<svg')
  view.unmount()
  await new Promise((resolve) => setTimeout(resolve, 5))
  expect(client.getQueryCache().getAll()).toHaveLength(0)
})
