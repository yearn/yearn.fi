import {
  getBrowserWalletIcon,
  getWalletConnectionErrorMessage,
  selectBrowserWalletConnectors
} from '@yearn/wallet-ui/connectors'
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

  it.each([false, true])('prefers discovered Trust regardless of connector order (reversed: %s)', (reversed) => {
    const configured = {
      ...wallet('trust'),
      yearnWallet: { rdns: 'com.trustwallet.app', iconUrl: 'trust.svg' }
    }
    const discovered = { ...wallet('com.trustwallet.app'), name: 'Trust Wallet', icon: 'announced.svg' }
    const pair = reversed ? [discovered, configured] : [configured, discovered]
    const rabby = wallet('io.rabby')
    const walletchan = wallet('com.walletchan')
    const choices = selectBrowserWalletConnectors([wallet('injected'), ...pair, rabby, walletchan])
    expect(choices).toEqual([discovered, rabby, walletchan])
    expect(choices[0]).toBe(discovered)
    expect(getBrowserWalletIcon(discovered, pair)).toBe('announced.svg')
  })

  it('keeps configured Trust without a matching announcement and does not merge display names', () => {
    const configured = {
      ...wallet('trust'),
      name: 'Trust Wallet',
      yearnWallet: { rdns: 'com.trustwallet.app', iconUrl: 'trust.svg' }
    }
    const unrelated = { ...wallet('another.wallet'), name: 'Trust Wallet' }
    expect(selectBrowserWalletConnectors([wallet('injected'), configured, unrelated])).toEqual([configured, unrelated])
    expect(getBrowserWalletIcon(configured, [configured])).toBe('trust.svg')
    expect(getBrowserWalletIcon(unrelated, [configured, unrelated])).toBeUndefined()
    expect(getBrowserWalletIcon(wallet('com.trustwallet.app'), [configured])).toBe('trust.svg')
  })

  it('clears user cancellations and gives actionable provider errors', () => {
    expect(getWalletConnectionErrorMessage(new Error('User rejected request'))).toBeUndefined()
    expect(getWalletConnectionErrorMessage(new Error('Provider not found'))).toContain('Install or enable')
    expect(getWalletConnectionErrorMessage(new Error('Network failed'))).toContain('network connection')
  })
})
