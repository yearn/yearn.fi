// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Erc4626VaultWidget } from '@yearn/vault-widget/erc4626'
import { VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { WidgetActionType } from '@yearn/vault-widget/types'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@yearn/vault-widget/erc4626/useErc4626Vault', () => ({
  useErc4626Vault: () => ({
    vault: { name: 'Retired Test Vault', asset: { symbol: 'TEST', decimals: 18 } },
    vaultUserData: { depositedValue: 0n },
    refetch: vi.fn()
  })
}))
vi.mock('@yearn/vault-widget/internal/components/widget', () => ({
  Widget: ({ mode }: { mode: WidgetActionType }) => <div data-testid="transaction-form">{mode}</div>,
  WidgetTabs: ({ onActionChange }: { onActionChange: (mode: WidgetActionType) => void }) => (
    <>
      <button type="button" onClick={() => onActionChange(WidgetActionType.Deposit)}>
        Deposit
      </button>
      <button type="button" onClick={() => onActionChange(WidgetActionType.Withdraw)}>
        Withdraw
      </button>
    </>
  )
}))
const address = '0x1111111111111111111111111111111111111111'
const second = '0x2222222222222222222222222222222222222222'
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)
const deposit = () => fireEvent.click(screen.getByRole('button', { name: 'Deposit' }))
const accept = () => {
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue to deposit' }))
}
const mode = () => screen.getByTestId('transaction-form').textContent

describe('retired vault deposits', () => {
  it('starts on withdraw and requires checkbox acceptance before mounting the deposit form', () => {
    render(<Erc4626VaultWidget address={address} chainId={1} isRetired />)
    expect(mode()).toBe(WidgetActionType.Withdraw)
    deposit()
    expect(mode()).toBe(WidgetActionType.Withdraw)
    const proceed = screen.getByRole('button', { name: 'Continue to deposit' }) as HTMLButtonElement
    expect(proceed.disabled).toBe(true)
    fireEvent.submit(proceed.closest('form')!)
    expect(mode()).toBe(WidgetActionType.Withdraw)
    accept()
    expect(mode()).toBe(WidgetActionType.Deposit)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('leaves withdraw active when cancelled, and asks again after returning to withdraw', () => {
    render(<Erc4626VaultWidget address={address} chainId={1} isRetired />)
    deposit()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mode()).toBe(WidgetActionType.Withdraw)
    deposit()
    accept()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    deposit()
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true }))
    expect(mode()).toBe(WidgetActionType.Withdraw)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('does not carry acknowledgment into another vault', () => {
    const view = render(<Erc4626VaultWidget address={address} chainId={1} isRetired />)
    deposit()
    accept()
    view.rerender(<Erc4626VaultWidget address={second} chainId={1} isRetired />)
    expect(mode()).toBe(WidgetActionType.Withdraw)
    deposit()
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })
  it('resets when the host explicitly reselects the same retired vault', () => {
    const view = render(<Erc4626VaultWidget address={address} chainId={1} isRetired selectionRevision={0} />)
    deposit()
    accept()
    view.rerender(<Erc4626VaultWidget address={address} chainId={1} isRetired selectionRevision={1} />)
    expect(mode()).toBe(WidgetActionType.Withdraw)
  })
  it('does not carry acknowledgment into another wallet', () => {
    const widget = (owner: typeof address | typeof second) => (
      <VaultWidgetRuntimeProvider value={{ wallet: { address: owner } }}>
        <Erc4626VaultWidget address={address} chainId={1} isRetired />
      </VaultWidgetRuntimeProvider>
    )
    const view = render(widget(address))
    deposit()
    accept()
    view.rerender(widget(second))
    expect(mode()).toBe(WidgetActionType.Withdraw)
  })
  it('keeps deposits gated while metadata loads and when retirement is discovered', () => {
    const view = render(<Erc4626VaultWidget address={address} chainId={1} isCheckingRetirement />)
    deposit()
    expect(mode()).toBe(WidgetActionType.Withdraw)
    view.rerender(<Erc4626VaultWidget address={address} chainId={1} isRetired />)
    expect(mode()).toBe(WidgetActionType.Withdraw)
    deposit()
    expect(screen.getByRole('dialog')).toBeDefined()
  })
  it('preserves ordinary deposit and withdrawal switching for active vaults', () => {
    render(<Erc4626VaultWidget address={address} chainId={1} />)
    expect(mode()).toBe(WidgetActionType.Deposit)
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    deposit()
    expect(mode()).toBe(WidgetActionType.Deposit)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
