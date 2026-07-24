import type { Address } from 'viem'
import type { VaultWidgetActivity, VaultWidgetActivityStatus } from '../types'
import type { VaultWidgetActivityStore, VaultWidgetSettings, VaultWidgetSettingsStore } from './types'

const DEFAULT_SETTINGS: VaultWidgetSettings = {
  autoStake: true,
  maxLossBps: 100,
  slippagePercent: 0.5,
  solver: 'enso'
}

type BrowserSettingsOptions = {
  namespace?: string
  keys?: Partial<Record<keyof VaultWidgetSettings, string>>
  defaults?: Partial<VaultWidgetSettings>
}

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : (JSON.parse(value) as T)
  } catch {
    return fallback
  }
}

export function createBrowserSettingsStore(options: BrowserSettingsOptions = {}): VaultWidgetSettingsStore {
  const namespace = options.namespace ?? 'yearn-widget'
  const defaults = { ...DEFAULT_SETTINGS, ...options.defaults }
  const keys: Record<keyof VaultWidgetSettings, string> = {
    autoStake: options.keys?.autoStake ?? `${namespace}/auto-stake`,
    maxLossBps: options.keys?.maxLossBps ?? `${namespace}/max-loss-bps`,
    slippagePercent: options.keys?.slippagePercent ?? `${namespace}/slippage-percent`,
    solver: options.keys?.solver ?? `${namespace}/solver`
  }

  const read = (): VaultWidgetSettings => ({
    autoStake: readStoredValue(keys.autoStake, defaults.autoStake),
    maxLossBps: readStoredValue(keys.maxLossBps, defaults.maxLossBps),
    slippagePercent: readStoredValue(keys.slippagePercent, defaults.slippagePercent),
    solver: readStoredValue(keys.solver, defaults.solver)
  })

  return {
    read,
    write(settings): void {
      if (typeof window === 'undefined') return
      Object.entries(settings).forEach(([setting, value]) => {
        window.localStorage.setItem(keys[setting as keyof VaultWidgetSettings], JSON.stringify(value))
      })
      window.dispatchEvent(new Event(`${namespace}:settings`))
    },
    subscribe(listener): () => void {
      if (typeof window === 'undefined') return () => undefined
      const eventName = `${namespace}:settings`
      window.addEventListener(eventName, listener)
      window.addEventListener('storage', listener)
      return () => {
        window.removeEventListener(eventName, listener)
        window.removeEventListener('storage', listener)
      }
    }
  }
}

export function createYearnFiSettingsStore(): VaultWidgetSettingsStore {
  const maxLossKey = 'yearn.fi/max-loss'
  const store = createBrowserSettingsStore({
    namespace: 'yearn.fi',
    keys: {
      autoStake: 'yearn.fi/staking-op-boosted-vaults',
      maxLossBps: maxLossKey,
      slippagePercent: 'yearn.fi/zap-slippage',
      solver: 'yearn.fi/zap-provider'
    }
  })

  return {
    ...store,
    read(): VaultWidgetSettings {
      const settings = store.read()
      if (typeof window === 'undefined') return settings

      try {
        const serialized = window.localStorage.getItem(maxLossKey)
        if (!serialized) return settings
        const value: unknown = JSON.parse(serialized)
        if (
          value &&
          typeof value === 'object' &&
          '__type' in value &&
          value.__type === 'bigint' &&
          'value' in value &&
          typeof value.value === 'string' &&
          /^\d+$/.test(value.value)
        ) {
          return { ...settings, maxLossBps: Number(BigInt(value.value) * 100n) }
        }
      } catch {
        return settings
      }

      return settings
    },
    write(settings): void {
      store.write(settings)
      if (typeof window === 'undefined') return
      const legacyPercent = BigInt(Math.max(0, Math.round(settings.maxLossBps / 100)))
      window.localStorage.setItem(
        maxLossKey,
        JSON.stringify({
          __type: 'bigint',
          value: legacyPercent.toString()
        })
      )
    }
  }
}

const IDB_DATABASE = 'yearn-notifications'
const IDB_STORE = 'notifications'
const IDB_VERSION = 2

type LegacyNotification = {
  id?: number
  address: Address
  amount: string
  chainId: number
  destinationTxHash?: `0x${string}`
  executionChainId?: number
  fromAddress?: Address
  status: VaultWidgetActivityStatus
  timeFinished?: number
  toAddress?: Address
  toChainId?: number
  txHash?: `0x${string}`
  type: VaultWidgetActivity['type']
}

function openActivityDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DATABASE, IDB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Unable to open activity database'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        const store = database.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true })
        ;[
          'address',
          'chainId',
          'amount',
          'blockNumber',
          'fromAddress',
          'fromTokenName',
          'spenderAddress',
          'spenderName',
          'toAddress',
          'toTokenName',
          'status',
          'timeFinished',
          'txHash'
        ].forEach((name) => {
          store.createIndex(name, name)
        })
      }
    }
  })
}

function runStoreRequest<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openActivityDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(IDB_STORE, mode)
        const request = operation(transaction.objectStore(IDB_STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Activity database request failed'))
        transaction.oncomplete = () => database.close()
      })
  )
}

function toActivity(notification: LegacyNotification): VaultWidgetActivity {
  return {
    id: notification.id,
    account: notification.address,
    amount: notification.amount,
    chainId: notification.chainId,
    destinationChainId: notification.toChainId,
    destinationHash: notification.destinationTxHash,
    hash: notification.txHash,
    status: notification.status,
    timestamp: notification.timeFinished ?? 0,
    tokenIn: notification.fromAddress,
    tokenOut: notification.toAddress,
    type: notification.type
  }
}

function toLegacyNotification(activity: VaultWidgetActivity): LegacyNotification {
  return {
    id: activity.id,
    address: activity.account,
    amount: activity.amount,
    chainId: activity.chainId,
    destinationTxHash: activity.destinationHash,
    executionChainId: activity.chainId,
    fromAddress: activity.tokenIn,
    status: activity.status,
    timeFinished: activity.timestamp,
    toAddress: activity.tokenOut,
    toChainId: activity.destinationChainId,
    txHash: activity.hash,
    type: activity.type
  }
}

export function createYearnFiActivityStore(): VaultWidgetActivityStore {
  return {
    async list(account): Promise<readonly VaultWidgetActivity[]> {
      const notifications = await runStoreRequest<LegacyNotification[]>('readonly', (store) => store.getAll())
      const normalizedAccount = account?.toLowerCase()
      return notifications
        .filter((notification) => !normalizedAccount || notification.address.toLowerCase() === normalizedAccount)
        .map(toActivity)
        .toSorted((a, b) => b.timestamp - a.timestamp)
    },
    async add(activity): Promise<number> {
      const id = await runStoreRequest<IDBValidKey>('readwrite', (store) => store.add(toLegacyNotification(activity)))
      return Number(id)
    },
    async update(id, activity): Promise<void> {
      const existing = await runStoreRequest<LegacyNotification | undefined>('readonly', (store) => store.get(id))
      if (!existing) return
      const next = toLegacyNotification({ ...toActivity(existing), ...activity, id })
      await runStoreRequest<IDBValidKey>('readwrite', (store) => store.put(next))
    },
    async remove(id): Promise<void> {
      await runStoreRequest<undefined>('readwrite', (store) => store.delete(id))
    }
  }
}

export function createMemoryActivityStore(): VaultWidgetActivityStore {
  const activities: VaultWidgetActivity[] = []

  return {
    async list(account): Promise<readonly VaultWidgetActivity[]> {
      return activities
        .filter((activity) => !account || activity.account.toLowerCase() === account.toLowerCase())
        .toSorted((a, b) => b.timestamp - a.timestamp)
    },
    async add(activity): Promise<number> {
      const id = activities.length + 1
      activities.push({ ...activity, id })
      return id
    },
    async update(id, activity): Promise<void> {
      const index = activities.findIndex((candidate) => candidate.id === id)
      if (index === -1) return
      activities[index] = { ...activities[index]!, ...activity }
    },
    async remove(id): Promise<void> {
      const index = activities.findIndex((activity) => activity.id === id)
      if (index !== -1) activities.splice(index, 1)
    }
  }
}
