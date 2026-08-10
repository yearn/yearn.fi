import {
  createVaultWidgetRuntime,
  DEFAULT_VAULT_WIDGET_RUNTIME,
  useVaultWidgetRuntime,
  type VaultWidgetRuntime,
  VaultWidgetRuntimeProvider
} from '@yearn/vault-widget/runtime'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const TOKEN = {
  address: '0x0000000000000000000000000000000000000001' as const,
  chainId: 1
}

describe('createVaultWidgetRuntime', () => {
  it('uses safe disconnected defaults', async () => {
    const runtime = createVaultWidgetRuntime()

    expect(runtime.wallet.connected).toBe(false)
    expect(runtime.wallet.isLoading).toBe(false)
    expect(runtime.wallet.hasCompletedLoad).toBe(true)
    expect(runtime.settings.autoStake).toBe(false)
    expect(runtime.routing.isEnsoEnabled({ chainId: 1 })).toBe(false)
    expect(runtime.prices.getUsdPrice(TOKEN)).toBe(0)
    expect(runtime.assets.getTokenLogoUrl(TOKEN)).toBeUndefined()
    expect(
      await runtime.notifications.create({
        amount: '1',
        fromAddress: TOKEN.address,
        fromChainId: 1,
        fromSymbol: 'TOKEN',
        type: 'deposit'
      })
    ).toBeUndefined()
    await expect(runtime.notifications.update({ id: 1, status: 'success' })).resolves.toBeUndefined()
  })

  it('merges nested host adapters and derives asset URLs', () => {
    const track = vi.fn()
    const runtime = createVaultWidgetRuntime({
      analytics: { track },
      assets: { baseUri: 'https://assets.example' },
      chains: { resolveExecutionChainId: (chainId) => (chainId === 1 ? 31337 : chainId) },
      settings: { autoStake: true, slippagePercent: 0.25 },
      wallet: { connected: true }
    })

    runtime.analytics.track('deposit', { chainId: 1 })

    expect(track).toHaveBeenCalledWith('deposit', { chainId: 1 })
    expect(runtime.wallet.connected).toBe(true)
    expect(runtime.settings).toMatchObject({ autoStake: true, slippagePercent: 0.25 })
    expect(runtime.chains.isConnectedToExecutionChain(31337, 1)).toBe(true)
    expect(runtime.assets.getTokenLogoUrl(TOKEN)).toBe(
      'https://assets.example/tokens/1/0x0000000000000000000000000000000000000001/logo-32.png'
    )
    expect(runtime.assets.getChainLogoUrl(1)).toBe('https://assets.example/chains/1/logo.svg')
  })

  it('does not mutate the exported default runtime', () => {
    const runtime = createVaultWidgetRuntime({ wallet: { connected: true } })

    expect(runtime).not.toBe(DEFAULT_VAULT_WIDGET_RUNTIME)
    expect(DEFAULT_VAULT_WIDGET_RUNTIME.wallet.connected).toBe(false)
  })

  it('inherits parent adapters when a preset overrides one section', () => {
    const open = vi.fn()
    const track = vi.fn()
    const observed: { current?: VaultWidgetRuntime } = {}
    const Probe = () => {
      observed.current = useVaultWidgetRuntime()
      return null
    }

    renderToStaticMarkup(
      createElement(
        VaultWidgetRuntimeProvider,
        { value: { analytics: { track }, assets: { baseUri: 'https://assets.example' } } },
        createElement(
          VaultWidgetRuntimeProvider,
          { value: { wallet: { connected: true, open } } },
          createElement(Probe)
        )
      )
    )

    expect(observed.current?.wallet.connected).toBe(true)
    expect(observed.current?.wallet.open).toBe(open)
    expect(observed.current?.analytics.track).toBe(track)
    expect(observed.current?.assets.baseUri).toBe('https://assets.example')
  })
})
