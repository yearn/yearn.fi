// @vitest-environment jsdom
import { VaultApp } from '@erc4626/components/VaultApp'
import { useYearnAllocators } from '@erc4626/lib/useVaultDiscovery'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Erc4626VaultWidgetProps } from '@yearn/vault-widget/erc4626'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@erc4626/components/Header', () => ({ Header: () => null }))
vi.mock('@erc4626/lib/wagmiConfig', () => ({ wagmiConfig: {} }))
vi.mock('wagmi', () => ({ useAccount: () => ({}) }))
vi.mock('@yearn/vault-widget', () => ({
  Erc4626VaultWidget: ({ isRetired, isCheckingRetirement, onSelectVault }: Erc4626VaultWidgetProps) => (
    <>
      <div data-testid="retirement">{isCheckingRetirement ? 'checking' : isRetired ? 'retired' : 'active'}</div>
      <button type="button" onClick={onSelectVault}>
        Select vault
      </button>
    </>
  )
}))
const address = '0x1111111111111111111111111111111111111111'
vi.mock('@erc4626/components/VaultPicker', () => ({
  VaultPicker: ({ onSelect }: { onSelect: (selection: { address: string; chainId: number }) => void }) => (
    <button type="button" onClick={() => onSelect({ address, chainId: 1 })}>
      Use address
    </button>
  )
}))
function PickerCatalog() {
  const catalog = useYearnAllocators(true)
  return <div data-testid="picker-catalog">{catalog.data?.map((vault) => vault.address).join(',')}</div>
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('catalog retirement status', () => {
  it.each(['deep link', 'pasted address'])('retains hidden allocator retirement for a %s', async (entry) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            address,
            chainId: 1,
            name: 'Hidden retired allocator',
            origin: 'yearn',
            kind: 'Multi Strategy',
            apiVersion: '3.0.4',
            isHidden: true,
            isRetired: true
          }
        ]
      })
    )
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <VaultApp initialChain="1" initialAddress={entry === 'deep link' ? address : undefined} />
        <PickerCatalog />
      </QueryClientProvider>
    )
    if (entry === 'pasted address') {
      fireEvent.click(screen.getByRole('button', { name: 'Select vault' }))
      fireEvent.click(screen.getByRole('button', { name: 'Use address' }))
    }
    await waitFor(() => expect(screen.getByTestId('retirement').textContent).toBe('retired'))
    expect(screen.getByTestId('picker-catalog').textContent).toBe('')
  })
})
