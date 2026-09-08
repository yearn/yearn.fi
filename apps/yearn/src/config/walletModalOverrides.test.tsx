// @vitest-environment jsdom

import { ReownWalletModalOverrides } from '@yearn/wallet-ui/ReownWalletModalOverrides'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

it('only customizes the AppKit modal, including later views, and cleans up on unmount', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const unrelatedView = document.createElement('w3m-all-wallets-view')
  const unrelatedRoot = unrelatedView.attachShadow({ mode: 'open' })
  const modal = document.createElement('w3m-modal')
  const modalRoot = modal.attachShadow({ mode: 'open' })
  const view = document.createElement('w3m-all-wallets-view')
  const viewRoot = view.attachShadow({ mode: 'open' })
  const toolbar = document.createElement('div')
  const search = document.createElement('wui-search-bar')
  const approvedSwitch = document.createElement('wui-certified-switch')
  const item = document.createElement('w3m-all-wallets-list-item')
  const itemRoot = item.attachShadow({ mode: 'open' })
  const overrideSelector = 'style[data-wallet-ui-reown-overrides]'

  try {
    await act(async () => root.render(<ReownWalletModalOverrides />))
    await act(async () => document.body.append(unrelatedView, modal))
    await act(async () => modalRoot.append(view))
    await act(async () => {
      toolbar.append(search, approvedSwitch)
      viewRoot.append(toolbar, item)
    })

    expect(unrelatedRoot.querySelector(overrideSelector)).toBeNull()
    expect(viewRoot.querySelector(overrideSelector)?.textContent).toContain('wui-search-bar')
    expect(viewRoot.querySelector(overrideSelector)?.textContent).toContain('wui-certified-switch')
    expect(toolbar.hasAttribute('data-wallet-ui-empty-toolbar')).toBe(true)
    expect(itemRoot.querySelector(overrideSelector)?.textContent).toContain("wui-icon[name='walletConnectBrown']")

    const mobileQrButton = document.createElement('wui-icon-box')
    await act(async () => toolbar.append(mobileQrButton))
    expect(toolbar.hasAttribute('data-wallet-ui-empty-toolbar')).toBe(false)

    await act(async () => root.unmount())
    expect(viewRoot.querySelector(overrideSelector)).toBeNull()
    expect(itemRoot.querySelector(overrideSelector)).toBeNull()
    expect(toolbar.hasAttribute('data-wallet-ui-empty-toolbar')).toBe(false)

    await act(async () => mobileQrButton.remove())
    expect(viewRoot.querySelector(overrideSelector)).toBeNull()
    expect(toolbar.hasAttribute('data-wallet-ui-empty-toolbar')).toBe(false)
  } finally {
    await act(async () => root.unmount())
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  }
})
