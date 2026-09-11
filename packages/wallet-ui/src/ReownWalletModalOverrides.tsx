'use client'

import { useEffect } from 'react'

const OVERRIDE_STYLE_ATTRIBUTE = 'data-wallet-ui-reown-overrides'
const EMPTY_TOOLBAR_ATTRIBUTE = 'data-wallet-ui-empty-toolbar'
const ALL_WALLETS_VIEW_STYLES = `
  wui-search-bar,
  wui-certified-switch {
    display: none !important;
  }

  [${EMPTY_TOOLBAR_ATTRIBUTE}] {
    display: none !important;
  }
`
const WALLET_LIST_ITEM_STYLES = `
  wui-icon[name='walletConnectBrown'] {
    display: none !important;
  }

  wui-text.certified {
    max-width: 86px !important;
  }
`

function installReownWalletModalOverrides(): () => void {
  const observedRoots = new WeakSet<ShadowRoot>()
  const observers = new Set<MutationObserver>()
  const overrideStyles = new Set<HTMLStyleElement>()
  const customizedToolbars = new Set<HTMLElement>()

  function addOverrideStyle(root: ShadowRoot, styles: string) {
    if (root.querySelector(`style[${OVERRIDE_STYLE_ATTRIBUTE}]`)) {
      return
    }

    const style = document.createElement('style')
    style.setAttribute(OVERRIDE_STYLE_ATTRIBUTE, '')
    style.textContent = styles
    root.append(style)
    overrideStyles.add(style)
  }

  function applyOverrides(root: ShadowRoot) {
    if (root.host.localName === 'w3m-all-wallets-view') {
      addOverrideStyle(root, ALL_WALLETS_VIEW_STYLES)

      const toolbar = root.querySelector('wui-search-bar')?.parentElement

      if (toolbar) {
        toolbar.toggleAttribute(EMPTY_TOOLBAR_ATTRIBUTE, !toolbar.querySelector('wui-icon-box'))
        customizedToolbars.add(toolbar)
      }
    }

    if (root.host.localName === 'w3m-all-wallets-list-item') {
      addOverrideStyle(root, WALLET_LIST_ITEM_STYLES)
    }
  }

  function inspectTree(element: Element | ShadowRoot) {
    if (element instanceof Element && element.shadowRoot) {
      observeRoot(element.shadowRoot)
    }

    element.querySelectorAll('*').forEach((descendant) => {
      if (descendant.shadowRoot) {
        observeRoot(descendant.shadowRoot)
      }
    })
  }

  function observeRoot(root: ShadowRoot) {
    if (observedRoots.has(root)) {
      applyOverrides(root)
      return
    }

    observedRoots.add(root)
    applyOverrides(root)
    inspectTree(root)

    const observer = new MutationObserver((mutations) => {
      applyOverrides(root)
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            inspectTree(node)
          }
        })
      })
    })

    observer.observe(root, { childList: true, subtree: true })
    observers.add(observer)
  }

  function inspectModal(node: Node) {
    if (node instanceof Element && node.localName === 'w3m-modal' && node.shadowRoot) {
      observeRoot(node.shadowRoot)
    }
  }

  // AppKit appends its modal directly to body; unrelated page trees need no inspection.
  const bodyObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(inspectModal)
    })
  })
  bodyObserver.observe(document.body, { childList: true })
  observers.add(bodyObserver)
  Array.from(document.body.children).forEach(inspectModal)

  return () => {
    observers.forEach((observer) => {
      observer.disconnect()
    })
    overrideStyles.forEach((style) => {
      style.remove()
    })
    customizedToolbars.forEach((toolbar) => {
      toolbar.removeAttribute(EMPTY_TOOLBAR_ATTRIBUTE)
    })
  }
}

export function ReownWalletModalOverrides() {
  // Reown renders these controls inside nested shadow roots, so there is no declarative app stylesheet hook.
  useEffect(() => installReownWalletModalOverrides(), [])

  return null
}
