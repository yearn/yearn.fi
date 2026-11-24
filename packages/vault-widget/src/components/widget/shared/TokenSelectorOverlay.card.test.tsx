// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  TokenSelectorCardContext,
  TokenSelectorOverlay
} from '@yearn/vault-widget/internal/components/widget/shared/TokenSelectorOverlay'
import { VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

const address = '0x1111111111111111111111111111111111111111'
const token = {
  address,
  chainId: 1,
  decimals: 6,
  name: 'Sample token',
  symbol: 'TKN',
  balanceRaw: 25_000_000n,
  usdValue: 50
} as const
const choose = vi.fn()
const baseUsdc = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  chainId: 8453,
  decimals: 6,
  name: 'USD Coin',
  symbol: 'USDC',
  balanceRaw: 0n
} as const
function Host({ revision = 0, mode = 'deposit' }: { revision?: number; mode?: 'deposit' | 'withdraw' }) {
  const [card, setCard] = useState<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  return (
    <VaultWidgetRuntimeProvider
      value={{
        wallet: {
          tokensByChain: { 1: { [address]: token } },
          getToken: (ref) =>
            ref.chainId === 8453 && ref.address.toLowerCase() === baseUsdc.address.toLowerCase()
              ? baseUsdc
              : ref.chainId === 1 && ref.address === address
                ? token
                : undefined
        },
        catalog: {
          tokenListsByChain: { 1: { [address]: token }, 8453: { [baseUsdc.address.toLowerCase()]: baseUsdc } }
        },
        routing: { tokenSelectionChainIds: [1], withdrawalTokenSelectionChainIds: [1, 8453] }
      }}
    >
      <TokenSelectorCardContext.Provider value={card}>
        <div ref={setCard} data-erc4626-card>
          <div data-erc4626-content>
            <button type="button" onClick={() => setOpen(true)}>
              Select asset
            </button>
            <span>Vault selector {revision}</span>
            {open && (
              <TokenSelectorOverlay
                chainId={1}
                value={address}
                mode={mode}
                priorityTokens={{ 8453: [baseUsdc.address] }}
                onClose={() => setOpen(false)}
                onChange={(...args) => {
                  choose(...args)
                  setOpen(false)
                }}
              />
            )}
          </div>
        </div>
      </TokenSelectorCardContext.Provider>
    </VaultWidgetRuntimeProvider>
  )
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('covers the entire host card, disables its form, and restores the trigger on dismissal', () => {
  render(<Host />)
  const trigger = screen.getByRole('button', { name: 'Select asset' })
  trigger.focus()
  fireEvent.click(trigger)
  const picker = screen.getByRole('dialog', { name: 'Select token' })
  const overlay = picker.closest('[data-token-selector-overlay]')
  const content = document.querySelector<HTMLElement>('[data-erc4626-content]')!
  expect(overlay?.parentElement).toBe(document.querySelector('[data-erc4626-card]'))
  expect(content.contains(picker)).toBe(false)
  expect(content.inert).toBe(true)
  expect(document.activeElement).toBe(picker)
  expect(screen.getByRole('heading', { name: 'Select a token' })).toBeDefined()
  expect(
    screen.getByRole('region', { name: 'Your tokens' }).querySelector('[data-token-wallet-balance]')?.textContent
  ).toContain('$50.00')
  fireEvent.keyDown(picker, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Select token' })).toBeNull()
  expect(content.inert).toBe(false)
  expect(document.activeElement).toBe(trigger)
})
it('keeps search focus during parent updates and preserves token selection and the combined network control', () => {
  const view = render(<Host />)
  fireEvent.click(screen.getByRole('button', { name: 'Select asset' }))
  const search = screen.getByRole('searchbox', { name: 'Search tokens or paste a token address' })
  search.focus()
  fireEvent.change(search, { target: { value: 'TKN' } })
  view.rerender(<Host revision={1} />)
  expect(document.activeElement).toBe(search)
  expect((search as HTMLInputElement).value).toBe('TKN')
  const network = document.querySelector('summary[aria-label="Filter by network"]')!
  expect(network.parentElement?.parentElement).toBe(search.parentElement)
  fireEvent.click(network)
  fireEvent.click(screen.getByRole('button', { name: 'Ethereum' }))
  fireEvent.click(screen.getByRole('button', { name: /Sample token/ }))
  expect(choose).toHaveBeenCalledWith(address, 1)
  expect(screen.queryByRole('dialog', { name: 'Select token' })).toBeNull()
})
it('offers destination networks and popular tokens with zero wallet balance for withdrawals', () => {
  render(<Host mode="withdraw" />)
  fireEvent.click(screen.getByRole('button', { name: 'Select asset' }))
  fireEvent.click(document.querySelector('summary[aria-label="Filter by network"]')!)
  fireEvent.click(screen.getByRole('button', { name: /^Base$/ }))
  const popular = screen.getByRole('region', { name: 'Popular tokens' })
  expect(popular.textContent).toContain('USDC')
  fireEvent.click(screen.getByRole('button', { name: /USD Coin/ }))
  expect(choose).toHaveBeenCalledWith(baseUsdc.address, 8453)
})
