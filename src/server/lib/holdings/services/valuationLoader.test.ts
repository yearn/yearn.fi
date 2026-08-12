import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getHistoricalPriceFetchFailedBatches,
  setHistoricalPriceFetchFailedBatches
} from '@/server/lib/holdings/services/defillama'
import {
  getPpsFetchFailedVaultKeys,
  getPpsFetchFailedVaults,
  type PPSTimeline,
  setPpsFetchFailureMetadata
} from '@/server/lib/holdings/services/kong'
import { createHoldingsValuationLoader } from '@/server/lib/holdings/services/valuationLoader'

const providerMocks = vi.hoisted(() => ({
  fetchMultipleVaultsPPS: vi.fn(),
  fetchHistoricalPricesForTokenTimestamps: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/kong', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/lib/holdings/services/kong')>()
  return {
    ...original,
    fetchMultipleVaultsPPS: providerMocks.fetchMultipleVaultsPPS
  }
})

vi.mock('@/server/lib/holdings/services/defillama', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/lib/holdings/services/defillama')>()
  return {
    ...original,
    fetchHistoricalPricesForTokenTimestamps: providerMocks.fetchHistoricalPricesForTokenTimestamps
  }
})

type TDeferred<T> = Readonly<{
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}>

function createDeferred<T>(): TDeferred<T> {
  const controls: {
    resolve: (value: T) => void
    reject: (reason?: unknown) => void
  } = {
    resolve: () => undefined,
    reject: () => undefined
  }
  const promise = new Promise<T>((resolve, reject) => {
    controls.resolve = resolve
    controls.reject = reject
  })

  return {
    promise,
    resolve: (value) => controls.resolve(value),
    reject: (reason) => controls.reject(reason)
  }
}

async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve))
}

function createPpsResult(entries: Array<[string, PPSTimeline]>): Map<string, PPSTimeline> {
  const result = new Map(entries)
  setPpsFetchFailureMetadata(result, [])
  return result
}

function createHistoricalPriceResult(
  requests: Array<{ chainId: number; address: string; timestamps: number[] }>
): Map<string, Map<number, number>> {
  return new Map(
    requests.map(({ chainId, address, timestamps }) => [
      `${chainId === 1 ? 'ethereum' : 'optimism'}:${address.toLowerCase()}`,
      new Map(timestamps.map((timestamp) => [timestamp, timestamp / 100_000]))
    ])
  )
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('createHoldingsValuationLoader', () => {
  it('creates an isolated key for each request-scoped loader', () => {
    const first = createHoldingsValuationLoader()
    const second = createHoldingsValuationLoader()

    expect(first.key).toMatch(/^holdings-valuation:/)
    expect(second.key).toMatch(/^holdings-valuation:/)
    expect(first.key).not.toBe(second.key)
  })

  it('canonicalizes and coalesces concurrent PPS requests while returning only each caller subset', async () => {
    providerMocks.fetchMultipleVaultsPPS.mockImplementation(
      async (vaults: Array<{ chainId: number; vaultAddress: string }>) => {
        const result = new Map<string, PPSTimeline>(
          vaults.map(({ chainId, vaultAddress }) => {
            const key = `${chainId}:${vaultAddress.toLowerCase()}`
            return [key, key === '10:0xbbb' ? new Map() : new Map([[100, chainId + 0.25]])]
          })
        )
        setPpsFetchFailureMetadata(result, ['10:0xbbb'])
        return result
      }
    )
    const loader = createHoldingsValuationLoader()

    const firstPromise = loader.fetchVaultPps([
      { chainId: 1, vaultAddress: ' 0xAAA ' },
      { chainId: 10, vaultAddress: '0xBBB' }
    ])
    const secondPromise = loader.fetchVaultPps([
      { chainId: 1, vaultAddress: '0xaaa' },
      { chainId: 1, vaultAddress: '0xCCC' }
    ])
    const [first, second] = await Promise.all([firstPromise, secondPromise])

    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(1)
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledWith([
      { chainId: 1, vaultAddress: '0xaaa' },
      { chainId: 10, vaultAddress: '0xbbb' },
      { chainId: 1, vaultAddress: '0xccc' }
    ])
    expect(Array.from(first.keys())).toEqual(['1:0xaaa', '10:0xbbb'])
    expect(Array.from(second.keys())).toEqual(['1:0xaaa', '1:0xccc'])
    expect(getPpsFetchFailedVaults(first)).toBe(1)
    expect(getPpsFetchFailedVaultKeys(first)).toEqual(['10:0xbbb'])
    expect(getPpsFetchFailedVaults(second)).toBe(0)
    expect(getPpsFetchFailedVaultKeys(second)).toEqual([])
  })

  it('keeps resolved PPS data for the loader lifetime without exposing mutable cache state', async () => {
    providerMocks.fetchMultipleVaultsPPS.mockResolvedValue(createPpsResult([['1:0xaaa', new Map([[100, 1.25]])]]))
    const loader = createHoldingsValuationLoader()
    const first = await loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xAAA' }])

    first.get('1:0xaaa')?.set(100, 99)
    first.set('1:injected', new Map([[100, 99]]))
    const second = await loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xaaa' }])

    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(1)
    expect(second.get('1:0xaaa')?.get(100)).toBe(1.25)
    expect(second.has('1:injected')).toBe(false)
  })

  it('does not make an earlier PPS caller wait for an unrelated later batch', async () => {
    const firstProviderResult = createDeferred<Map<string, PPSTimeline>>()
    const secondProviderResult = createDeferred<Map<string, PPSTimeline>>()
    providerMocks.fetchMultipleVaultsPPS
      .mockReturnValueOnce(firstProviderResult.promise)
      .mockReturnValueOnce(secondProviderResult.promise)
    const loader = createHoldingsValuationLoader()
    const settled = { first: false, second: false }
    const firstPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xAAA' }]).then((result) => {
      settled.first = true
      return result
    })

    await flushMicrotasks()
    const secondPromise = loader.fetchVaultPps([{ chainId: 10, vaultAddress: '0xBBB' }]).then((result) => {
      settled.second = true
      return result
    })
    await flushMicrotasks()

    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(2)
    firstProviderResult.resolve(createPpsResult([['1:0xaaa', new Map([[100, 1.1]])]]))
    await firstPromise
    expect(settled).toEqual({ first: true, second: false })

    secondProviderResult.resolve(createPpsResult([['10:0xbbb', new Map([[100, 1.2]])]]))
    await secondPromise
    expect(settled).toEqual({ first: true, second: true })
  })

  it('forks an in-flight PPS key when a later higher-priority caller needs it', async () => {
    const balanceProviderResult = createDeferred<Map<string, PPSTimeline>>()
    const growthProviderResult = createDeferred<Map<string, PPSTimeline>>()
    providerMocks.fetchMultipleVaultsPPS
      .mockReturnValueOnce(balanceProviderResult.promise)
      .mockReturnValueOnce(growthProviderResult.promise)
    const loader = createHoldingsValuationLoader()
    const settled = { growth: false, balance: false }
    const balancePromise = loader
      .fetchVaultPps(
        [
          { chainId: 1, vaultAddress: '0xAAA' },
          { chainId: 1, vaultAddress: '0xBBB' }
        ],
        { consumer: 'balance' }
      )
      .then((result) => {
        settled.balance = true
        return result
      })

    await flushMicrotasks()
    const growthPromise = loader
      .fetchVaultPps([{ chainId: 1, vaultAddress: '0xaaa' }], { consumer: 'growth' })
      .then((result) => {
        settled.growth = true
        return result
      })
    await flushMicrotasks()

    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(2)
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls[1]).toEqual([[{ chainId: 1, vaultAddress: '0xaaa' }]])
    growthProviderResult.resolve(createPpsResult([['1:0xaaa', new Map([[100, 1.1]])]]))
    await growthPromise
    expect(settled).toEqual({ growth: true, balance: false })

    balanceProviderResult.resolve(
      createPpsResult([
        ['1:0xaaa', new Map([[100, 1.1]])],
        ['1:0xbbb', new Map([[100, 1.2]])]
      ])
    )
    await balancePromise
    expect(settled).toEqual({ growth: true, balance: true })
  })

  it('promotes shared PPS keys and dispatches bounded batches in consumer-priority order', async () => {
    providerMocks.fetchMultipleVaultsPPS.mockImplementation(
      async (vaults: Array<{ chainId: number; vaultAddress: string }>) =>
        createPpsResult(
          vaults.map(({ chainId, vaultAddress }) => [
            `${chainId}:${vaultAddress}`,
            new Map([[100, chainId + Number.parseInt(vaultAddress.slice(-1), 16) / 10]])
          ])
        )
    )
    const loader = createHoldingsValuationLoader()

    const balancePromise = loader.fetchVaultPps(
      [
        { chainId: 1, vaultAddress: '0xAAA' },
        { chainId: 1, vaultAddress: '0xBBB' }
      ],
      { consumer: 'balance' }
    )
    const protocolPromise = loader.fetchVaultPps(
      [
        { chainId: 1, vaultAddress: '0xaaa' },
        { chainId: 1, vaultAddress: '0xCCC' }
      ],
      { consumer: 'protocol-return' }
    )
    const growthPromise = loader.fetchVaultPps(
      [
        { chainId: 1, vaultAddress: '0xaaa' },
        { chainId: 1, vaultAddress: '0xDDD' }
      ],
      { consumer: 'growth' }
    )
    const [balance, protocol, growth] = await Promise.all([balancePromise, protocolPromise, growthPromise])

    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(3)
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls).toEqual([
      [
        [
          { chainId: 1, vaultAddress: '0xaaa' },
          { chainId: 1, vaultAddress: '0xddd' }
        ],
        { concurrency: 1 }
      ],
      [[{ chainId: 1, vaultAddress: '0xccc' }], { concurrency: 1 }],
      [[{ chainId: 1, vaultAddress: '0xbbb' }], { concurrency: 1 }]
    ])
    expect(Array.from(balance.keys())).toEqual(['1:0xaaa', '1:0xbbb'])
    expect(Array.from(protocol.keys())).toEqual(['1:0xaaa', '1:0xccc'])
    expect(Array.from(growth.keys())).toEqual(['1:0xaaa', '1:0xddd'])
  })

  it('coalesces historical prices by canonical token and timestamp and returns caller subsets', async () => {
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(
      async (requests: Array<{ chainId: number; address: string; timestamps: number[] }>) =>
        new Map(
          requests.map(({ chainId, address, timestamps }) => [
            `${chainId === 1 ? 'ethereum' : 'optimism'}:${address.toLowerCase()}`,
            new Map(timestamps.map((timestamp) => [timestamp, chainId + timestamp / 1_000]))
          ])
        )
    )
    const loader = createHoldingsValuationLoader()

    const firstPromise = loader.fetchHistoricalPrices([{ chainId: 1, address: ' 0xAAA ', timestamps: [100, 200, 200] }])
    const secondPromise = loader.fetchHistoricalPrices([
      { chainId: 1, address: '0xaaa', timestamps: [200, 300] },
      { chainId: 10, address: '0xBBB', timestamps: [100] }
    ])
    const [first, second] = await Promise.all([firstPromise, secondPromise])

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(1)
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledWith(
      [
        { chainId: 1, address: '0xaaa', timestamps: [100, 200, 300] },
        { chainId: 10, address: '0xbbb', timestamps: [100] }
      ],
      { resolution: 'strict' }
    )
    expect(first).toEqual(
      new Map([
        [
          'ethereum:0xaaa',
          new Map([
            [100, 1.1],
            [200, 1.2]
          ])
        ]
      ])
    )
    expect(second).toEqual(
      new Map([
        [
          'ethereum:0xaaa',
          new Map([
            [200, 1.2],
            [300, 1.3]
          ])
        ],
        ['optimism:0xbbb', new Map([[100, 10.1]])]
      ])
    )
  })

  it('lets a higher-priority price caller finish while a balance batch remains in flight', async () => {
    const protocolProviderResult = createDeferred<Map<string, Map<number, number>>>()
    const balanceProviderResult = createDeferred<Map<string, Map<number, number>>>()
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation((requests: Array<{ address: string }>) =>
      requests.some(({ address }) => address === '0xaaa')
        ? protocolProviderResult.promise
        : balanceProviderResult.promise
    )
    const loader = createHoldingsValuationLoader()
    const settled = { protocol: false, balance: false }
    const balancePromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xBBB', timestamps: [100] }], { consumer: 'balance' })
      .then((result) => {
        settled.balance = true
        return result
      })
    const protocolPromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [100] }], {
        consumer: 'protocol-return'
      })
      .then((result) => {
        settled.protocol = true
        return result
      })

    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)
    protocolProviderResult.resolve(new Map([['ethereum:0xaaa', new Map([[100, 1.1]])]]))
    await protocolPromise
    expect(settled).toEqual({ protocol: true, balance: false })

    balanceProviderResult.resolve(new Map([['ethereum:0xbbb', new Map([[100, 1.2]])]]))
    await balancePromise
    expect(settled).toEqual({ protocol: true, balance: true })
  })

  it('forks a bounded late price overlap without disturbing the contiguous in-flight balance range', async () => {
    const timestamps = [86_399, 172_799, 259_199]
    const balanceProviderResult = createDeferred<Map<string, Map<number, number>>>()
    const protocolProviderResult = createDeferred<Map<string, Map<number, number>>>()
    providerMocks.fetchHistoricalPricesForTokenTimestamps
      .mockReturnValueOnce(balanceProviderResult.promise)
      .mockReturnValueOnce(protocolProviderResult.promise)
    const loader = createHoldingsValuationLoader()
    const settled = { protocol: false, balance: false }
    const balancePromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps }], {
        resolution: 'utc_day',
        consumer: 'balance'
      })
      .then((result) => {
        settled.balance = true
        return result
      })

    await flushMicrotasks()
    const protocolPromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xaaa', timestamps: [timestamps[1]!] }], {
        resolution: 'utc_day',
        consumer: 'protocol-return'
      })
      .then((result) => {
        settled.protocol = true
        return result
      })
    await flushMicrotasks()

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls).toEqual([
      [[{ chainId: 1, address: '0xaaa', timestamps }], { resolution: 'utc_day' }],
      [[{ chainId: 1, address: '0xaaa', timestamps: [172_799] }], { resolution: 'utc_day' }]
    ])
    protocolProviderResult.resolve(new Map([['ethereum:0xaaa', new Map([[172_799, 1.2]])]]))
    await protocolPromise
    expect(settled).toEqual({ protocol: true, balance: false })

    balanceProviderResult.resolve(
      new Map([['ethereum:0xaaa', new Map(timestamps.map((timestamp) => [timestamp, timestamp / 100_000]))]])
    )
    await balancePromise
    expect(settled).toEqual({ protocol: true, balance: true })
  })

  it('uses bounded range fillers without making the higher-priority subset wait for balance', async () => {
    const timestamps = [86_399, 172_799, 259_199]
    const protocolProviderResult = createDeferred<Map<string, Map<number, number>>>()
    const balanceProviderResult = createDeferred<Map<string, Map<number, number>>>()
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(
      (requests: Array<{ timestamps: number[] }>) =>
        requests[0]?.timestamps.length === 1 ? protocolProviderResult.promise : balanceProviderResult.promise
    )
    const loader = createHoldingsValuationLoader()
    const settled = { protocol: false, balance: false }
    const balancePromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps }], {
        resolution: 'utc_day',
        consumer: 'balance'
      })
      .then((result) => {
        settled.balance = true
        return result
      })
    const protocolPromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xaaa', timestamps: [timestamps[1]!] }], {
        resolution: 'utc_day',
        consumer: 'protocol-return'
      })
      .then((result) => {
        settled.protocol = true
        return result
      })

    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls).toEqual([
      [[{ chainId: 1, address: '0xaaa', timestamps: [172_799] }], { resolution: 'utc_day' }],
      [[{ chainId: 1, address: '0xaaa', timestamps }], { resolution: 'utc_day' }]
    ])

    protocolProviderResult.resolve(new Map([['ethereum:0xaaa', new Map([[172_799, 1.2]])]]))
    await protocolPromise
    expect(settled).toEqual({ protocol: true, balance: false })

    balanceProviderResult.resolve(
      new Map([['ethereum:0xaaa', new Map(timestamps.map((timestamp) => [timestamp, timestamp / 100_000]))]])
    )
    const balance = await balancePromise
    expect(settled).toEqual({ protocol: true, balance: true })
    expect(Array.from(balance.get('ethereum:0xaaa')?.keys() ?? [])).toEqual(timestamps)
  })

  it('uses an in-flight protocol-first point as a delayed balance range filler', async () => {
    const timestamps = [86_399, 172_799, 259_199]
    const protocolProviderResult = createDeferred<Map<string, Map<number, number>>>()
    const balanceProviderResult = createDeferred<Map<string, Map<number, number>>>()
    providerMocks.fetchHistoricalPricesForTokenTimestamps
      .mockReturnValueOnce(protocolProviderResult.promise)
      .mockReturnValueOnce(balanceProviderResult.promise)
    const loader = createHoldingsValuationLoader()
    const settled = { protocol: false, balance: false }
    const protocolPromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [timestamps[1]!] }], {
        resolution: 'utc_day',
        consumer: 'protocol-return'
      })
      .then((result) => {
        settled.protocol = true
        return result
      })

    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(1)
    const balancePromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xaaa', timestamps }], {
        resolution: 'utc_day',
        consumer: 'balance'
      })
      .then((result) => {
        settled.balance = true
        return result
      })
    await flushMicrotasks()

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls).toEqual([
      [[{ chainId: 1, address: '0xaaa', timestamps: [172_799] }], { resolution: 'utc_day' }],
      [[{ chainId: 1, address: '0xaaa', timestamps }], { resolution: 'utc_day' }]
    ])
    protocolProviderResult.resolve(new Map([['ethereum:0xaaa', new Map([[172_799, 1.2]])]]))
    await protocolPromise
    expect(settled).toEqual({ protocol: true, balance: false })

    balanceProviderResult.resolve(createHistoricalPriceResult([{ chainId: 1, address: '0xaaa', timestamps }]))
    const balance = await balancePromise
    expect(settled).toEqual({ protocol: true, balance: true })
    expect(Array.from(balance.get('ethereum:0xaaa')?.keys() ?? [])).toEqual(timestamps)
  })

  it('uses a successfully settled protocol-first point as a delayed balance range filler', async () => {
    const timestamps = [86_399, 172_799, 259_199]
    providerMocks.fetchHistoricalPricesForTokenTimestamps
      .mockResolvedValueOnce(new Map([['ethereum:0xaaa', new Map([[172_799, 1.2]])]]))
      .mockImplementationOnce(async (requests) => createHistoricalPriceResult(requests))
    const loader = createHoldingsValuationLoader()

    await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [timestamps[1]!] }], {
      resolution: 'utc_day',
      consumer: 'protocol-return'
    })
    const balance = await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xaaa', timestamps }], {
      resolution: 'utc_day',
      consumer: 'balance'
    })

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls).toEqual([
      [[{ chainId: 1, address: '0xaaa', timestamps: [172_799] }], { resolution: 'utc_day' }],
      [[{ chainId: 1, address: '0xaaa', timestamps }], { resolution: 'utc_day' }]
    ])
    expect(Array.from(balance.get('ethereum:0xaaa')?.keys() ?? [])).toEqual(timestamps)
  })

  it('does not reuse a settled missing price as a delayed balance range filler', async () => {
    const timestamps = [86_399, 172_799, 259_199]
    providerMocks.fetchHistoricalPricesForTokenTimestamps
      .mockResolvedValueOnce(new Map([['ethereum:0xaaa', new Map()]]))
      .mockImplementationOnce(async (requests) => createHistoricalPriceResult(requests))
    const loader = createHoldingsValuationLoader()

    await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [timestamps[1]!] }], {
      resolution: 'utc_day',
      consumer: 'protocol-return'
    })
    const balance = await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xaaa', timestamps }], {
      resolution: 'utc_day',
      consumer: 'balance'
    })

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls).toEqual([
      [[{ chainId: 1, address: '0xaaa', timestamps: [172_799] }], { resolution: 'utc_day' }],
      [[{ chainId: 1, address: '0xaaa', timestamps: [86_399, 259_199] }], { resolution: 'utc_day' }]
    ])
    expect(Array.from(balance.get('ethereum:0xaaa')?.keys() ?? [])).toEqual([86_399, 259_199])
  })

  it('bounds request-local price dispatches while reserving capacity for protocol work', async () => {
    const balanceTimestamps = [86_399, 172_799, 345_599, 431_999, 604_799, 691_199]
    const balanceFirstResult = createDeferred<Map<string, Map<number, number>>>()
    const protocolResult = createDeferred<Map<string, Map<number, number>>>()
    const balanceSecondResult = createDeferred<Map<string, Map<number, number>>>()
    const balanceThirdResult = createDeferred<Map<string, Map<number, number>>>()
    providerMocks.fetchHistoricalPricesForTokenTimestamps
      .mockReturnValueOnce(balanceFirstResult.promise)
      .mockReturnValueOnce(protocolResult.promise)
      .mockReturnValueOnce(balanceSecondResult.promise)
      .mockReturnValueOnce(balanceThirdResult.promise)
    const loader = createHoldingsValuationLoader()
    const settled = { protocol: false, balance: false }
    const balancePromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: balanceTimestamps }], {
        resolution: 'utc_day',
        consumer: 'balance'
      })
      .then((result) => {
        settled.balance = true
        return result
      })

    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(1)
    const protocolPromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xBBB', timestamps: [100] }], {
        resolution: 'strict',
        consumer: 'protocol-return'
      })
      .then((result) => {
        settled.protocol = true
        return result
      })
    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)

    const protocolRequests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[1]?.[0] ?? []
    protocolResult.resolve(createHistoricalPriceResult(protocolRequests))
    await protocolPromise
    expect(settled).toEqual({ protocol: true, balance: false })
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)

    const firstBalanceRequests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[0]?.[0] ?? []
    balanceFirstResult.resolve(createHistoricalPriceResult(firstBalanceRequests))
    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(3)

    const secondBalanceRequests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[2]?.[0] ?? []
    balanceSecondResult.resolve(createHistoricalPriceResult(secondBalanceRequests))
    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(4)

    const thirdBalanceRequests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[3]?.[0] ?? []
    balanceThirdResult.resolve(createHistoricalPriceResult(thirdBalanceRequests))
    const balance = await balancePromise
    expect(settled).toEqual({ protocol: true, balance: true })
    expect(Array.from(balance.get('ethereum:0xaaa')?.keys() ?? [])).toEqual(balanceTimestamps)
  })

  it('splits balance ranges instead of duplicating an unbounded promoted overlap', async () => {
    const timestamps = Array.from({ length: 259 }, (_value, index) => (index + 1) * 86_400 - 1)
    const promotedTimestamps = timestamps.slice(1, -1)
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(
      async (requests: Array<{ address: string; timestamps: number[] }>) =>
        new Map(
          requests.map(({ address, timestamps: requestedTimestamps }) => [
            `ethereum:${address}`,
            new Map(requestedTimestamps.map((timestamp) => [timestamp, timestamp / 100_000]))
          ])
        )
    )
    const loader = createHoldingsValuationLoader()

    const [balance, protocol] = await Promise.all([
      loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps }], {
        resolution: 'utc_day',
        consumer: 'balance'
      }),
      loader.fetchHistoricalPrices([{ chainId: 1, address: '0xaaa', timestamps: promotedTimestamps }], {
        resolution: 'utc_day',
        consumer: 'protocol-return'
      })
    ])

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)
    const requestedProviderTimestamps = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls.flatMap(
      ([requests]) => (requests as Array<{ timestamps: number[] }>).flatMap(({ timestamps }) => timestamps)
    )
    expect(requestedProviderTimestamps).toHaveLength(timestamps.length)
    expect(new Set(requestedProviderTimestamps).size).toBe(timestamps.length)
    expect(balance.get('ethereum:0xaaa')?.size).toBe(timestamps.length)
    expect(protocol.get('ethereum:0xaaa')?.size).toBe(promotedTimestamps.length)
  })

  it('keeps strict and UTC-day price requests in separate batches and caches', async () => {
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(
      async (
        requests: Array<{ chainId: number; address: string; timestamps: number[] }>,
        options: { resolution: 'strict' | 'utc_day' }
      ) =>
        new Map([
          [
            'ethereum:0xaaa',
            new Map(requests[0]?.timestamps.map((timestamp) => [timestamp, options.resolution === 'strict' ? 1 : 2]))
          ]
        ])
    )
    const loader = createHoldingsValuationLoader()
    const request = [{ chainId: 1, address: '0xAAA', timestamps: [100] }]

    const [strictResult, utcDayResult] = await Promise.all([
      loader.fetchHistoricalPrices(request),
      loader.fetchHistoricalPrices(request, { resolution: 'utc_day' })
    ])
    const [cachedStrictResult, cachedUtcDayResult] = await Promise.all([
      loader.fetchHistoricalPrices(request),
      loader.fetchHistoricalPrices(request, { resolution: 'utc_day' })
    ])

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls.map(([, options]) => options)).toEqual([
      { resolution: 'strict' },
      { resolution: 'utc_day' }
    ])
    expect(strictResult.get('ethereum:0xaaa')?.get(100)).toBe(1)
    expect(utcDayResult.get('ethereum:0xaaa')?.get(100)).toBe(2)
    expect(cachedStrictResult.get('ethereum:0xaaa')?.get(100)).toBe(1)
    expect(cachedUtcDayResult.get('ethereum:0xaaa')?.get(100)).toBe(2)
  })

  it('shares one UTC-day cache point while preserving each caller timestamp key', async () => {
    const receiptTimestamp = 1_700_000_000
    const dayEndTimestamp = 1_700_006_399
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockResolvedValue(
      new Map([['ethereum:0xaaa', new Map([[dayEndTimestamp, 1.25]])]])
    )
    const loader = createHoldingsValuationLoader()

    const [receiptResult, dayEndResult] = await Promise.all([
      loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [receiptTimestamp] }], {
        resolution: 'utc_day'
      }),
      loader.fetchHistoricalPrices([{ chainId: 1, address: '0xaaa', timestamps: [dayEndTimestamp] }], {
        resolution: 'utc_day'
      })
    ])

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(1)
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledWith(
      [{ chainId: 1, address: '0xaaa', timestamps: [dayEndTimestamp] }],
      { resolution: 'utc_day' }
    )
    expect(receiptResult.get('ethereum:0xaaa')?.get(receiptTimestamp)).toBe(1.25)
    expect(dayEndResult.get('ethereum:0xaaa')?.get(dayEndTimestamp)).toBe(1.25)
  })

  it('preserves historical-price failure metadata across request-lifetime cache hits', async () => {
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(async () => {
      const result = new Map([
        [
          'ethereum:0xaaa',
          new Map([
            [100, 1.1],
            [200, 1.2]
          ])
        ]
      ])
      setHistoricalPriceFetchFailedBatches(result, 2)
      return result
    })
    const loader = createHoldingsValuationLoader()
    const first = await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [100, 200] }])
    const cached = await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xaaa', timestamps: [100] }])

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(1)
    expect(getHistoricalPriceFetchFailedBatches(first)).toBe(2)
    expect(getHistoricalPriceFetchFailedBatches(cached)).toBe(2)
  })

  it('does not attribute a balance-only price failure to a protocol-return subset', async () => {
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(
      async (requests: Array<{ chainId: number; address: string; timestamps: number[] }>) => {
        const result = new Map(
          requests.map(({ address, timestamps }) => [
            `ethereum:${address}`,
            new Map(timestamps.map((timestamp) => [timestamp, address === '0xaaa' ? 1.1 : 1.2]))
          ])
        )
        if (requests.some(({ address }) => address === '0xbbb')) {
          result.set('ethereum:0xbbb', new Map())
          setHistoricalPriceFetchFailedBatches(result, 1)
        }
        return result
      }
    )
    const loader = createHoldingsValuationLoader()
    const balancePromise = loader.fetchHistoricalPrices(
      [
        { chainId: 1, address: '0xAAA', timestamps: [100] },
        { chainId: 1, address: '0xBBB', timestamps: [100] }
      ],
      { resolution: 'utc_day', consumer: 'balance' }
    )
    const protocolPromise = loader.fetchHistoricalPrices(
      [
        { chainId: 1, address: '0xaaa', timestamps: [100] },
        { chainId: 1, address: '0xCCC', timestamps: [100] }
      ],
      { resolution: 'utc_day', consumer: 'protocol-return' }
    )
    const [balance, protocol] = await Promise.all([balancePromise, protocolPromise])

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls).toEqual([
      [
        [
          { chainId: 1, address: '0xaaa', timestamps: [86_399] },
          { chainId: 1, address: '0xccc', timestamps: [86_399] }
        ],
        { resolution: 'utc_day' }
      ],
      [[{ chainId: 1, address: '0xbbb', timestamps: [86_399] }], { resolution: 'utc_day' }]
    ])
    expect(balance.get('ethereum:0xaaa')?.get(100)).toBe(1.1)
    expect(balance.get('ethereum:0xbbb')).toEqual(new Map())
    expect(protocol.get('ethereum:0xaaa')?.get(100)).toBe(1.1)
    expect(protocol.get('ethereum:0xccc')?.get(100)).toBe(1.2)
    expect(getHistoricalPriceFetchFailedBatches(balance)).toBe(1)
    expect(getHistoricalPriceFetchFailedBatches(protocol)).toBe(0)
  })

  it('rejects total provider failures, evicts affected entries, and allows a retry', async () => {
    providerMocks.fetchHistoricalPricesForTokenTimestamps
      .mockRejectedValueOnce(new Error('price provider unavailable'))
      .mockResolvedValueOnce(new Map([['ethereum:0xaaa', new Map([[100, 1.1]])]]))
    const loader = createHoldingsValuationLoader()
    const request = [{ chainId: 1, address: '0xAAA', timestamps: [100] }]

    await expect(loader.fetchHistoricalPrices(request, { consumer: 'balance' })).rejects.toThrow(
      'price provider unavailable'
    )
    await expect(loader.fetchHistoricalPrices(request)).resolves.toEqual(
      new Map([['ethereum:0xaaa', new Map([[100, 1.1]])]])
    )
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)
  })
})
