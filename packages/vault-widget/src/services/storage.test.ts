import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryActivityStore, createYearnFiSettingsStore } from './storage'

const originalWindow = globalThis.window

function createLocalStorage(entries: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(entries))
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  }
}

describe('createYearnFiSettingsStore', () => {
  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
      return
    }
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('uses the legacy 0.5 percent slippage default', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent: vi.fn(), localStorage: createLocalStorage() }
    })

    expect(createYearnFiSettingsStore().read().slippagePercent).toBe(0.5)
  })

  it('reads the existing serialized bigint maximum-loss value as basis points', () => {
    const localStorage = createLocalStorage({
      'yearn.fi/max-loss': JSON.stringify({ __type: 'bigint', value: '2' })
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent: vi.fn(), localStorage }
    })

    expect(createYearnFiSettingsStore().read().maxLossBps).toBe(200)
  })

  it('continues writing maximum loss in the legacy wagmi bigint shape', () => {
    const localStorage = createLocalStorage()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent: vi.fn(), localStorage }
    })
    const store = createYearnFiSettingsStore()

    store.write({
      autoStake: true,
      maxLossBps: 300,
      slippagePercent: 0.5,
      solver: 'enso'
    })

    expect(localStorage.getItem('yearn.fi/max-loss')).toBe(JSON.stringify({ __type: 'bigint', value: '3' }))
  })
})

describe('createMemoryActivityStore', () => {
  it('preserves Safe and bridge progress metadata needed after a reload', async () => {
    const store = createMemoryActivityStore()
    const id = await store.add({
      account: '0x1111111111111111111111111111111111111111',
      amount: '1',
      bridge: {
        destinationChainId: 10,
        protocol: 'relay',
        sourceChainId: 1
      },
      chainId: 1,
      isFinalTransaction: true,
      proposalId: '0x1234',
      status: 'submitted',
      timestamp: 1,
      type: 'crosschain zap'
    })

    expect(await store.list()).toEqual([
      expect.objectContaining({
        id,
        isFinalTransaction: true,
        proposalId: '0x1234',
        bridge: expect.objectContaining({ destinationChainId: 10, protocol: 'relay' })
      })
    ])
  })
})
