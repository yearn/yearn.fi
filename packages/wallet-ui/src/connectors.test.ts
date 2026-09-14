import { getWalletConnectionErrorMessage, selectBrowserWalletConnectors } from '@yearn/wallet-ui/connectors'
import { describe, expect, it } from 'vitest'

const wallet = (id: string, type = 'injected') => ({ id, name: id, type })

describe('browser wallet choices', () => {
  it('preserves multiple discovered providers and excludes transports, SDKs and Phantom', () => {
    const connectors = [
      wallet('injected'),
      wallet('io.rabby'),
      wallet('com.walletchan'),
      wallet('app.phantom'),
      wallet('safe', 'safe'),
      wallet('walletConnect', 'walletConnect'),
      wallet('coinbaseWalletSDK'),
      wallet('metaMaskSDK', 'metaMask'),
      wallet('auth')
    ]
    expect(selectBrowserWalletConnectors(connectors).map(({ id }) => id)).toEqual(['io.rabby', 'com.walletchan'])
  })

  it('uses a legacy provider only when no discovered provider exists, even for Phantom-only', () => {
    expect(selectBrowserWalletConnectors([wallet('injected')])).toEqual([wallet('injected')])
    expect(selectBrowserWalletConnectors([wallet('injected'), wallet('app.phantom')])).toEqual([])
  })

  it('deduplicates announced providers and explicitly allows the development wallet', () => {
    expect(
      selectBrowserWalletConnectors([wallet('io.rabby'), wallet('io.rabby'), wallet('agent', 'mock')], {
        additionalConnectorIds: ['agent']
      }).map(({ id }) => id)
    ).toEqual(['io.rabby', 'agent'])
  })

  it('clears user cancellations and gives actionable provider errors', () => {
    expect(getWalletConnectionErrorMessage(new Error('User rejected request'))).toBeUndefined()
    expect(getWalletConnectionErrorMessage(new Error('Provider not found'))).toContain('Install or enable')
    expect(getWalletConnectionErrorMessage(new Error('Network failed'))).toContain('network connection')
  })
})
