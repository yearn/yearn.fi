import {
  formatWalletAddress,
  getBrowserWalletLabel,
  getWalletConnectionErrorMessage,
  selectBrowserWalletConnectors,
  type TWalletConnectorSummary
} from '@ybold/lib/walletDrawer'
import { describe, expect, it } from 'vitest'

const connector = (overrides: Partial<TWalletConnectorSummary>): TWalletConnectorSummary => ({
  id: 'injected',
  name: 'Injected',
  type: 'injected',
  ...overrides
})

describe('wallet drawer connector selection', () => {
  it('returns every discovered browser wallet and removes the generic fallback', () => {
    const selected = selectBrowserWalletConnectors([
      connector({}),
      connector({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }),
      connector({ id: 'com.rabby', name: 'Rabby' }),
      connector({ id: 'io.metamask', name: 'MetaMask' })
    ])

    expect(selected.map(({ id }) => id)).toEqual(['com.rabby', 'io.metamask'])
  })

  it('excludes browser wallets outside the supported product set', () => {
    const selected = selectBrowserWalletConnectors([
      connector({}),
      connector({ id: 'app.phantom', name: 'Phantom' }),
      connector({ id: 'io.metamask', name: 'MetaMask' })
    ])

    expect(selected.map(({ id }) => id)).toEqual(['io.metamask'])
  })

  it('does not expose the legacy fallback when only an excluded wallet was announced', () => {
    const selected = selectBrowserWalletConnectors([connector({}), connector({ id: 'app.phantom', name: 'Phantom' })])

    expect(selected).toEqual([])
  })

  it('keeps the generic injected connector when no announced wallet exists', () => {
    const selected = selectBrowserWalletConnectors([
      connector({}),
      connector({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }),
      connector({ id: 'safe', name: 'Safe', type: 'safe' })
    ])

    expect(selected).toHaveLength(1)
    expect(selected[0]?.id).toBe('injected')
  })

  it('excludes unrelated and non-injected connectors', () => {
    const selected = selectBrowserWalletConnectors([
      connector({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }),
      connector({ id: 'safe', name: 'Safe', type: 'safe' }),
      connector({ id: 'coinbaseWalletSDK', name: 'Coinbase Wallet', type: 'coinbaseWallet' })
    ])

    expect(selected).toEqual([])
  })

  it('labels the generic injected connector as a browser wallet', () => {
    expect(getBrowserWalletLabel(connector({}))).toBe('Browser wallet')
  })
})

describe('wallet drawer error copy', () => {
  it('distinguishes cancellation from a missing extension', () => {
    expect(getWalletConnectionErrorMessage(new Error('User rejected the request'))).toContain('cancelled')
    expect(getWalletConnectionErrorMessage(new Error('Provider not found'))).toContain('No browser wallet')
  })

  it('uses a retryable fallback without exposing provider internals', () => {
    expect(getWalletConnectionErrorMessage(new Error('opaque connector failure'))).toBe(
      'The wallet could not be opened. Check the extension or network connection and try again.'
    )
  })
})

describe('wallet address formatting', () => {
  it('shows a stable compact account label', () => {
    expect(formatWalletAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678')
    expect(formatWalletAddress(undefined)).toBe('Wallet')
  })
})
