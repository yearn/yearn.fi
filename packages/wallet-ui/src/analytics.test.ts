import {
  connectionErrorCategory,
  createWalletAnalytics,
  getWalletAnalyticsProperties
} from '@yearn/wallet-ui/analytics'
import { describe, expect, it, vi } from 'vitest'

const rabby = { name: 'Rabby', type: 'injected' }
const metamask = { name: 'MetaMask', type: 'injected' }

describe('wallet analytics ownership and attribution', () => {
  it('retains the More wallets recovery path and deduplicates success', async () => {
    const track = vi.fn()
    const analytics = createWalletAnalytics(track)
    analytics.open({ entry_point: 'header' })
    const failed = analytics.start('detected', rabby, [rabby])
    analytics.finish(failed, 'error', rabby, 1, 'request_pending')
    const recovery = analytics.start('more_wallets', undefined, [rabby])
    analytics.finish(recovery, 'success', metamask, 1)
    analytics.finish(recovery, 'success', metamask, 1)
    analytics.close()
    await Promise.resolve()
    expect(track.mock.calls.filter(([event]) => event === 'connect_wallet')).toEqual([
      [
        'connect_wallet',
        expect.objectContaining({
          connector: 'MetaMask',
          chainID: '1',
          wallet_name: 'metamask',
          path: 'more_wallets',
          used_more_wallets: true,
          had_previous_failure: true,
          attempt_number: 2,
          initially_visible: false
        })
      ]
    ])
    expect(track.mock.calls.filter(([event]) => event === 'wallet_picker_closed')).toHaveLength(0)
  })

  it('ignores stale completions and separates dismissal from rejection', async () => {
    const track = vi.fn()
    const analytics = createWalletAnalytics(track)
    analytics.open({})
    const old = analytics.start('detected', rabby, [rabby])
    analytics.close()
    analytics.open({})
    const current = analytics.start('detected', metamask, [metamask])
    analytics.finish(old, 'success', rabby, 1)
    analytics.finish(current, 'rejected', metamask, 1, 'rejected')
    await Promise.resolve()
    expect(track.mock.calls.filter(([event]) => event === 'connect_wallet')).toHaveLength(0)
    expect(
      track.mock.calls.filter(([event]) => event === 'wallet_connect_result').map(([, props]) => props.outcome)
    ).toEqual(['closed_without_connection', 'rejected'])
  })

  it('reads the public WalletConnect peer name and never sends session identifiers', async () => {
    expect(
      await getWalletAnalyticsProperties({
        name: 'WalletConnect',
        type: 'walletConnect',
        getProvider: async () => ({
          session: { topic: 'secret', peer: { metadata: { name: 'Trust Wallet', url: 'https://private.example' } } }
        })
      })
    ).toEqual({ wallet_name: 'trust', wallet_name_source: 'session_metadata', connection_method: 'walletconnect' })
    expect(
      await getWalletAnalyticsProperties({
        name: 'WalletConnect',
        type: 'walletConnect',
        getProvider: async () => {
          throw new Error('offline')
        }
      })
    ).toMatchObject({ wallet_name: 'unknown' })
  })

  it('reports a successful initial suggestion without exporting installed-wallet inventory', async () => {
    const track = vi.fn()
    const analytics = createWalletAnalytics(track)
    analytics.open({})
    analytics.finish(analytics.start('detected', rabby, [rabby, metamask]), 'success', rabby, 1)
    await Promise.resolve()
    const success = track.mock.calls.find(([event]) => event === 'connect_wallet')?.[1]
    expect(success).toMatchObject({ initially_visible: true, used_more_wallets: false })
    expect(JSON.stringify(success)).not.toContain('metamask')
  })

  it('bounds missing WalletConnect metadata without delaying or duplicating connection completion', async () => {
    vi.useFakeTimers()
    const track = vi.fn()
    const analytics = createWalletAnalytics(track)
    const connector = { name: 'WalletConnect', type: 'walletConnect', getProvider: () => new Promise(() => undefined) }
    try {
      analytics.open({})
      const attempt = analytics.start('walletconnect', connector, [])
      analytics.finish(attempt, 'success', connector, 1)
      expect(analytics.active()).toBeUndefined()
      analytics.close()
      analytics.finish(attempt, 'success', connector, 1)
      await vi.advanceTimersByTimeAsync(500)
      expect(track.mock.calls.filter(([event]) => event === 'connect_wallet')).toEqual([
        ['connect_wallet', expect.objectContaining({ wallet_name: 'unknown', path: 'walletconnect' })]
      ])
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('contains tracker failures and normalizes nested errors', () => {
    const analytics = createWalletAnalytics(() => {
      throw new Error('tracker unavailable')
    })
    expect(() => analytics.open({})).not.toThrow()
    expect(connectionErrorCategory({ cause: { code: 4001, message: 'address 0x123' } })).toBe('rejected')
  })
})
