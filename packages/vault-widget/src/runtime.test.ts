import type { VaultWidgetExecutionAdapter } from '@yearn/vault-widget/headless'
import {
  createVaultWidgetRuntime,
  DEFAULT_VAULT_WIDGET_RUNTIME,
  useVaultWidgetRuntime,
  type VaultWidgetRuntime,
  VaultWidgetRuntimeProvider
} from '@yearn/vault-widget/runtime'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Hash, TransactionReceipt } from 'viem'
import { describe, expect, it, vi } from 'vitest'

const TOKEN = {
  address: '0x0000000000000000000000000000000000000001' as const,
  chainId: 1
}
const ACCOUNT = '0x1111111111111111111111111111111111111111' as const
const HASH = `0x${'1'.repeat(64)}` as Hash
const REQUEST = {
  chainId: 1,
  to: '0x2222222222222222222222222222222222222222' as const,
  data: '0x1234' as const
}

function createReceipt(): TransactionReceipt {
  return { status: 'success', transactionHash: HASH } as TransactionReceipt
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
    await expect(runtime.execution.switchChain({ chainId: 1 })).rejects.toThrow(
      'Vault widget transaction execution is not configured'
    )
    await expect(runtime.execution.execute({ account: ACCOUNT, request: REQUEST })).rejects.toThrow(
      'Vault widget transaction execution is not configured'
    )
    await expect(runtime.execution.waitForReceipt({ chainId: 1, hash: HASH })).rejects.toThrow(
      'Vault widget transaction execution is not configured'
    )
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

  it('merges partial execution overrides with safe defaults', async () => {
    const execute = vi.fn().mockResolvedValue(HASH)
    const runtime = createVaultWidgetRuntime({ execution: { execute } })

    await expect(runtime.execution.execute({ account: ACCOUNT, request: REQUEST })).resolves.toBe(HASH)
    expect(runtime.execution.execute).toBe(execute)
    await expect(runtime.execution.switchChain({ chainId: 1 })).rejects.toThrow(
      'Vault widget transaction execution is not configured'
    )
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

  it('inherits parent execution methods while allowing a nested partial override', async () => {
    const parentExecute = vi.fn().mockResolvedValue(HASH)
    const childExecute = vi.fn().mockResolvedValue(HASH)
    const switchChain = vi.fn().mockResolvedValue(undefined)
    const waitForReceipt = vi.fn().mockResolvedValue(createReceipt())
    const parentExecution: VaultWidgetExecutionAdapter = {
      execute: parentExecute,
      switchChain,
      waitForReceipt
    }
    const observed: { current?: VaultWidgetRuntime } = {}
    const Probe = () => {
      observed.current = useVaultWidgetRuntime()
      return null
    }

    renderToStaticMarkup(
      createElement(
        VaultWidgetRuntimeProvider,
        { value: { execution: parentExecution } },
        createElement(
          VaultWidgetRuntimeProvider,
          { value: { execution: { execute: childExecute } } },
          createElement(Probe)
        )
      )
    )

    await expect(observed.current?.execution.execute({ account: ACCOUNT, request: REQUEST })).resolves.toBe(HASH)
    await expect(observed.current?.execution.switchChain({ chainId: 1 })).resolves.toBeUndefined()
    await expect(observed.current?.execution.waitForReceipt({ chainId: 1, hash: HASH })).resolves.toEqual(
      createReceipt()
    )
    expect(observed.current?.execution.execute).toBe(childExecute)
    expect(observed.current?.execution.switchChain).toBe(switchChain)
    expect(observed.current?.execution.waitForReceipt).toBe(waitForReceipt)
    expect(parentExecute).not.toHaveBeenCalled()
  })
})
