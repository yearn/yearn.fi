import {
  formatWalletAddress,
  getBrowserWalletLabel,
  getWalletConnectionErrorMessage,
  selectBrowserWalletConnector,
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
  it('prefers a discovered MetaMask connector over generic injected and unrelated connectors', () => {
    const selected = selectBrowserWalletConnector([
      connector({}),
      connector({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }),
      connector({ id: 'com.rabby', name: 'Rabby' }),
      connector({ id: 'io.metamask', name: 'MetaMask' })
    ])

    expect(selected?.id).toBe('io.metamask')
  })

  it('uses another discovered browser wallet before the generic injected fallback', () => {
    const selected = selectBrowserWalletConnector([
      connector({}),
      connector({ id: 'com.rabby', name: 'Rabby' }),
      connector({ id: 'safe', name: 'Safe', type: 'safe' })
    ])

    expect(selected?.id).toBe('com.rabby')
    expect(getBrowserWalletLabel(selected)).toBe('Rabby')
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
