import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createBrowserActivityStore,
  createBrowserSettingsStore,
  createMemoryActivityStore,
  createYearnFiSettingsStore
} from './storage'

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

describe('createBrowserSettingsStore', () => {
  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
      return
    }
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('distinguishes configured defaults from persisted user choices', () => {
    const localStorage = createLocalStorage()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent: vi.fn(), localStorage }
    })
    const store = createBrowserSettingsStore({ namespace: 'test-widget' })

    expect(store.hasStored?.('slippagePercent')).toBe(false)
    store.write({ ...store.read(), slippagePercent: 1 })
    expect(store.hasStored?.('slippagePercent')).toBe(true)
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

describe('createBrowserActivityStore', () => {
  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
      return
    }
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('persists activity in an isolated namespace with execution metadata', async () => {
    const localStorage = createLocalStorage()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage }
    })
    const store = createBrowserActivityStore({ namespace: 'yearn-bold/vault-widget' })
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

    await store.update(id, { destinationHash: '0xabcd', status: 'success' })

    expect(await store.list('0x1111111111111111111111111111111111111111')).toEqual([
      expect.objectContaining({
        bridge: expect.objectContaining({ destinationChainId: 10, protocol: 'relay' }),
        destinationHash: '0xabcd',
        id,
        proposalId: '0x1234',
        status: 'success'
      })
    ])
    expect(localStorage.getItem('yearn-notifications')).toBeNull()
    expect(localStorage.getItem('yearn-bold/vault-widget/activity')).not.toBeNull()
  })

  it('limits retained history without dropping the newest activity', async () => {
    const localStorage = createLocalStorage()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage }
    })
    const store = createBrowserActivityStore({ maxEntries: 2, namespace: 'test-widget' })
    await store.add({
      account: '0x1111111111111111111111111111111111111111',
      amount: '1',
      chainId: 1,
      status: 'success',
      timestamp: 1,
      type: 'deposit'
    })
    await store.add({
      account: '0x1111111111111111111111111111111111111111',
      amount: '2',
      chainId: 1,
      status: 'success',
      timestamp: 2,
      type: 'deposit'
    })
    const newestId = await store.add({
      account: '0x1111111111111111111111111111111111111111',
      amount: '3',
      chainId: 1,
      status: 'success',
      timestamp: 3,
      type: 'deposit'
    })

    expect((await store.list()).map(({ id }) => id)).toEqual([newestId, newestId - 1])
  })
})
