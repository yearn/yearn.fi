// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultWidgetToken } from '../types'
import { TokenSelectorOverlay } from './TokenSelectorOverlay'

const ethereumToken: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 18,
  name: 'Ethereum asset',
  symbol: 'ETHA'
}
const optimismToken: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 10,
  decimals: 6,
  name: 'Optimism asset',
  symbol: 'OPTA'
}

function TokenIcon({ token }: { token: VaultWidgetToken; size: number }): ReactElement {
  return <span>{token.symbol.slice(0, 1)}</span>
}

describe('TokenSelectorOverlay', () => {
  it('takes focus, traps keyboard navigation, and closes with Escape', () => {
    const onClose = vi.fn()
    render(
      <TokenSelectorOverlay
        chains={[
          { id: 1, logoURI: '/ethereum.svg', name: 'Ethereum' },
          { id: 10, logoURI: '/optimism.svg', name: 'Optimism' }
        ]}
        mode="deposit"
        onChange={vi.fn()}
        onClose={onClose}
        selectedToken={ethereumToken}
        TokenIcon={TokenIcon}
        tokens={[ethereumToken, optimismToken]}
      />
    )

    const search = screen.getByRole('textbox', { name: 'Search tokens' })
    const first = screen.getByRole('button', { name: 'Ethereum' })
    const last = screen.getByRole('button', { name: /ETHA Ethereum asset/ })
    const dialog = screen.getByRole('dialog', { name: 'Select deposit token' })
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]')).filter(
      (element) =>
        element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
    )
    expect(focusable[0]).toBe(first)
    expect(focusable.at(-1)).toBe(last)
    expect(document.activeElement).toBe(search)

    last.focus()
    expect(fireEvent.keyDown(last, { code: 'Tab', key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(last, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('switches networks and searches all configured assets', () => {
    const onChange = vi.fn()
    render(
      <TokenSelectorOverlay
        defaultTokens={[{ address: ethereumToken.address, chainId: 1 }]}
        mode="withdraw"
        onChange={onChange}
        onClose={vi.fn()}
        selectedToken={ethereumToken}
        TokenIcon={TokenIcon}
        tokens={[ethereumToken, optimismToken]}
      />
    )

    expect(screen.getByRole('button', { name: /ETHA Ethereum asset/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Optimism' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search tokens' }), {
      target: { value: optimismToken.address }
    })
    fireEvent.click(screen.getByRole('button', { name: /OPTA Optimism asset/ }))
    expect(onChange).toHaveBeenCalledWith(optimismToken)
  })
})
