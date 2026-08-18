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
    fetchHistoricalPricesForTokenTimestamps: providerMocks.fetchHistoricalPricesForTokenTimestamps,
    supportsHistoricalPriceRangeRequests: () => true
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
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledWith(
      [
        { chainId: 1, vaultAddress: '0xaaa' },
        { chainId: 10, vaultAddress: '0xbbb' },
        { chainId: 1, vaultAddress: '0xccc' }
      ],
      { concurrency: 6 }
    )
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

  it('reuses an in-flight PPS key when a later higher-priority caller needs it', async () => {
    const balanceProviderResult = createDeferred<Map<string, PPSTimeline>>()
    providerMocks.fetchMultipleVaultsPPS.mockReturnValue(balanceProviderResult.promise)
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

    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(1)
    expect(settled).toEqual({ growth: false, balance: false })

    balanceProviderResult.resolve(
      createPpsResult([
        ['1:0xaaa', new Map([[100, 1.1]])],
        ['1:0xbbb', new Map([[100, 1.2]])]
      ])
    )
    await Promise.all([balancePromise, growthPromise])
    expect(settled).toEqual({ growth: true, balance: true })
    expect(
      providerMocks.fetchMultipleVaultsPPS.mock.calls.flatMap(([vaults]) =>
        vaults.filter(({ vaultAddress }) => vaultAddress === '0xaaa')
      )
    ).toHaveLength(1)
  })

  it('dispatches queued protocol and growth PPS work as two in-flight balance slots settle', async () => {
    const providerResults = Array.from({ length: 5 }, () => createDeferred<Map<string, PPSTimeline>>())
    providerMocks.fetchMultipleVaultsPPS.mockImplementation(
      () => providerResults[providerMocks.fetchMultipleVaultsPPS.mock.calls.length - 1]!.promise
    )
    const loader = createHoldingsValuationLoader()
    const balanceVaults = Array.from({ length: 72 }, (_value, index) => ({
      chainId: 1,
      vaultAddress: `0xbalance${index.toString(16).padStart(2, '0')}`
    }))
    const balancePromise = loader.fetchVaultPps(balanceVaults, { consumer: 'balance' })

    await flushMicrotasks()
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(2)

    const protocolPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xprotocol' }], {
      consumer: 'protocol-return'
    })
    const growthPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xgrowth' }], {
      consumer: 'growth'
    })
    await flushMicrotasks()
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(2)

    const firstBalanceVaults = providerMocks.fetchMultipleVaultsPPS.mock.calls[0]?.[0] ?? []
    providerResults[0]!.resolve(
      createPpsResult(
        firstBalanceVaults.map(({ chainId, vaultAddress }) => [`${chainId}:${vaultAddress}`, new Map([[100, 1]])])
      )
    )
    await flushMicrotasks()
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls[2]?.[0]).toEqual([{ chainId: 1, vaultAddress: '0xgrowth' }])

    const secondBalanceVaults = providerMocks.fetchMultipleVaultsPPS.mock.calls[1]?.[0] ?? []
    providerResults[1]!.resolve(
      createPpsResult(
        secondBalanceVaults.map(({ chainId, vaultAddress }) => [`${chainId}:${vaultAddress}`, new Map([[100, 1]])])
      )
    )
    await flushMicrotasks()
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls[3]?.[0]).toEqual([
      { chainId: 1, vaultAddress: '0xprotocol' }
    ])

    providerResults[2]!.resolve(createPpsResult([['1:0xgrowth', new Map([[100, 1]])]]))
    await growthPromise
    await flushMicrotasks()
    const thirdBalanceVaults = providerMocks.fetchMultipleVaultsPPS.mock.calls[4]?.[0] ?? []
    providerResults[4]!.resolve(
      createPpsResult(
        thirdBalanceVaults.map(({ chainId, vaultAddress }) => [`${chainId}:${vaultAddress}`, new Map([[100, 1]])])
      )
    )
    providerResults[3]!.resolve(createPpsResult([['1:0xprotocol', new Map([[100, 1]])]]))
    await Promise.all([balancePromise, protocolPromise, growthPromise])
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
        { concurrency: 6 }
      ],
      [[{ chainId: 1, vaultAddress: '0xccc' }], { concurrency: 6 }],
      [[{ chainId: 1, vaultAddress: '0xbbb' }], { concurrency: 6 }]
    ])
    expect(Array.from(balance.keys())).toEqual(['1:0xaaa', '1:0xbbb'])
    expect(Array.from(protocol.keys())).toEqual(['1:0xaaa', '1:0xccc'])
    expect(Array.from(growth.keys())).toEqual(['1:0xaaa', '1:0xddd'])
  })

  it('allocates six PPS requests to each of three concurrent consumer batches', async () => {
    providerMocks.fetchMultipleVaultsPPS.mockImplementation(
      async (vaults: Array<{ chainId: number; vaultAddress: string }>) =>
        createPpsResult(vaults.map(({ chainId, vaultAddress }) => [`${chainId}:${vaultAddress}`, new Map([[100, 1]])]))
    )
    const loader = createHoldingsValuationLoader()

    await Promise.all([
      loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xAAA' }], { consumer: 'growth' }),
      loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xBBB' }], { consumer: 'protocol-return' }),
      loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xCCC' }], { consumer: 'balance' })
    ])

    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls).toEqual([
      [[{ chainId: 1, vaultAddress: '0xaaa' }], { concurrency: 6 }],
      [[{ chainId: 1, vaultAddress: '0xbbb' }], { concurrency: 6 }],
      [[{ chainId: 1, vaultAddress: '0xccc' }], { concurrency: 6 }]
    ])
  })

  it('chunks a large PPS consumer and reuses capacity after a smaller consumer settles', async () => {
    const providerResults = Array.from({ length: 4 }, () => createDeferred<Map<string, PPSTimeline>>())
    providerMocks.fetchMultipleVaultsPPS.mockImplementation(
      () => providerResults[providerMocks.fetchMultipleVaultsPPS.mock.calls.length - 1]!.promise
    )
    const loader = createHoldingsValuationLoader()
    const growthVaults = Array.from({ length: 50 }, (_value, index) => ({
      chainId: 1,
      vaultAddress: `0x${index.toString(16).padStart(3, '0')}`
    }))
    const growthPromise = loader.fetchVaultPps(growthVaults, { consumer: 'growth' })
    const protocolPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xprotocol' }], {
      consumer: 'protocol-return'
    })

    await flushMicrotasks()
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(2)
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls.map(([vaults]) => vaults.length)).toEqual([24, 1])

    providerResults[1]!.resolve(createPpsResult([['1:0xprotocol', new Map([[100, 1]])]]))
    await protocolPromise
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(3)
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls[2]?.[0]).toHaveLength(24)

    const firstGrowthVaults = providerMocks.fetchMultipleVaultsPPS.mock.calls[0]?.[0] ?? []
    providerResults[0]!.resolve(
      createPpsResult(
        firstGrowthVaults.map(({ chainId, vaultAddress }) => [`${chainId}:${vaultAddress}`, new Map([[100, 1]])])
      )
    )
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls[3]?.[0]).toHaveLength(2)

    const remainingCallIndexes = [2, 3]
    remainingCallIndexes.forEach((callIndex) => {
      const vaults = providerMocks.fetchMultipleVaultsPPS.mock.calls[callIndex]?.[0] ?? []
      providerResults[callIndex]!.resolve(
        createPpsResult(vaults.map(({ chainId, vaultAddress }) => [`${chainId}:${vaultAddress}`, new Map([[100, 1]])]))
      )
    })
    await growthPromise
  })

  it('keeps later PPS flushes queued until one of two active provider batches settles', async () => {
    const firstProviderResult = createDeferred<Map<string, PPSTimeline>>()
    const secondProviderResult = createDeferred<Map<string, PPSTimeline>>()
    const thirdProviderResult = createDeferred<Map<string, PPSTimeline>>()
    const fourthProviderResult = createDeferred<Map<string, PPSTimeline>>()
    providerMocks.fetchMultipleVaultsPPS
      .mockReturnValueOnce(firstProviderResult.promise)
      .mockReturnValueOnce(secondProviderResult.promise)
      .mockReturnValueOnce(thirdProviderResult.promise)
      .mockReturnValueOnce(fourthProviderResult.promise)
    const loader = createHoldingsValuationLoader()
    const firstPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xAAA' }], { consumer: 'growth' })
    const secondPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xBBB' }], { consumer: 'protocol-return' })
    const thirdPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xCCC' }], { consumer: 'balance' })

    await flushMicrotasks()
    await flushMicrotasks()
    const fourthPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xDDD' }], { consumer: 'growth' })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(2)
    firstProviderResult.resolve(createPpsResult([['1:0xaaa', new Map([[100, 1]])]]))
    await firstPromise
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(3)

    secondProviderResult.resolve(createPpsResult([['1:0xbbb', new Map([[100, 1]])]]))
    await secondPromise
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(4)
    thirdProviderResult.resolve(createPpsResult([['1:0xddd', new Map([[100, 1]])]]))
    fourthProviderResult.resolve(createPpsResult([['1:0xccc', new Map([[100, 1]])]]))
    await Promise.all([secondPromise, thirdPromise, fourthPromise])
  })

  it('promotes a queued PPS batch without duplicating its vault request', async () => {
    const providerResults = Array.from({ length: 4 }, () => createDeferred<Map<string, PPSTimeline>>())
    providerMocks.fetchMultipleVaultsPPS.mockImplementation(
      () => providerResults[providerMocks.fetchMultipleVaultsPPS.mock.calls.length - 1]!.promise
    )
    const loader = createHoldingsValuationLoader()
    const firstBalancePromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xAAA' }], {
      consumer: 'balance'
    })
    const firstProtocolPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xBBB' }], {
      consumer: 'protocol-return'
    })
    const firstGrowthPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xEEE' }], {
      consumer: 'growth'
    })
    await flushMicrotasks()
    await flushMicrotasks()

    const balancePromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xCCC' }], {
      consumer: 'balance'
    })
    await flushMicrotasks()
    await flushMicrotasks()
    const promotedPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xccc' }], {
      consumer: 'growth'
    })
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(2)

    providerResults[0]!.resolve(createPpsResult([['1:0xeee', new Map([[100, 1]])]]))
    await firstGrowthPromise
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls[2]?.[0]).toEqual([{ chainId: 1, vaultAddress: '0xccc' }])

    providerResults[1]!.resolve(createPpsResult([['1:0xbbb', new Map([[100, 1]])]]))
    await firstProtocolPromise
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS.mock.calls[3]?.[0]).toEqual([{ chainId: 1, vaultAddress: '0xaaa' }])
    providerResults[2]!.resolve(createPpsResult([['1:0xccc', new Map([[100, 1]])]]))
    providerResults[3]!.resolve(createPpsResult([['1:0xaaa', new Map([[100, 1]])]]))
    await Promise.all([firstBalancePromise, firstProtocolPromise, balancePromise, promotedPromise])
    expect(
      providerMocks.fetchMultipleVaultsPPS.mock.calls.flatMap(([vaults]) =>
        vaults.filter(({ vaultAddress }) => vaultAddress === '0xccc')
      )
    ).toHaveLength(1)
  })

  it('dispatches PPS while all historical-price loader slots are occupied', async () => {
    const priceResults = Array.from({ length: 3 }, () => createDeferred<Map<string, Map<number, number>>>())
    const ppsResult = createDeferred<Map<string, PPSTimeline>>()
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(
      () => priceResults[providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls.length - 1]!.promise
    )
    providerMocks.fetchMultipleVaultsPPS.mockReturnValue(ppsResult.promise)
    const loader = createHoldingsValuationLoader()
    const pricePromises = [
      loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [100] }], {
        consumer: 'growth'
      }),
      loader.fetchHistoricalPrices([{ chainId: 1, address: '0xBBB', timestamps: [100] }], {
        consumer: 'protocol-return'
      }),
      loader.fetchHistoricalPrices([{ chainId: 1, address: '0xCCC', timestamps: [100] }], {
        consumer: 'balance'
      })
    ]

    await flushMicrotasks()
    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(3)

    const ppsPromise = loader.fetchVaultPps([{ chainId: 1, vaultAddress: '0xVault' }], {
      consumer: 'growth'
    })
    await flushMicrotasks()
    await flushMicrotasks()
    expect(providerMocks.fetchMultipleVaultsPPS).toHaveBeenCalledTimes(1)

    ppsResult.resolve(createPpsResult([['1:0xvault', new Map([[100, 1]])]]))
    priceResults.forEach((result, index) => {
      const requests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[index]?.[0] ?? []
      result.resolve(createHistoricalPriceResult(requests))
    })
    await Promise.all([...pricePromises, ppsPromise])
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

  it('reports a settled missing price while unrelated provider work is still in flight', async () => {
    const missingProviderResult = createDeferred<Map<string, Map<number, number>>>()
    const pendingProviderResult = createDeferred<Map<string, Map<number, number>>>()
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation((requests: Array<{ address: string }>) =>
      requests.some(({ address }) => address === '0xaaa')
        ? missingProviderResult.promise
        : pendingProviderResult.promise
    )
    const loader = createHoldingsValuationLoader()
    const missingObserver = vi.fn()
    const settled = { missing: false, pending: false }
    const missingPromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [100] }], {
        consumer: 'balance',
        onMissingHistoricalPrice: missingObserver
      })
      .then((result) => {
        settled.missing = true
        return result
      })
    await flushMicrotasks()
    const pendingPromise = loader
      .fetchHistoricalPrices([{ chainId: 1, address: '0xBBB', timestamps: [100] }], { consumer: 'balance' })
      .then((result) => {
        settled.pending = true
        return result
      })

    await flushMicrotasks()
    missingProviderResult.resolve(new Map([['ethereum:0xaaa', new Map()]]))
    await missingPromise

    expect(missingObserver).toHaveBeenCalledWith({ chainId: 1, address: '0xaaa', timestamps: [100] })
    expect(settled).toEqual({ missing: true, pending: false })

    pendingProviderResult.resolve(new Map([['ethereum:0xbbb', new Map([[100, 1.2]])]]))
    await pendingPromise
    expect(settled).toEqual({ missing: true, pending: true })
  })

  it('does not report a primary historical price that resolved successfully', async () => {
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockResolvedValue(
      new Map([['ethereum:0xaaa', new Map([[100, 1.1]])]])
    )
    const missingObserver = vi.fn()
    const loader = createHoldingsValuationLoader()

    await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps: [100] }], {
      consumer: 'balance',
      onMissingHistoricalPrice: missingObserver
    })

    expect(missingObserver).not.toHaveBeenCalled()
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

  it('uses an adaptive bounded filler budget to coalesce a large fragmented balance range', async () => {
    const tokenRequests = Array.from({ length: 30 }, (_value, tokenIndex) => {
      const allTimestamps = Array.from({ length: 101 }, (_unused, dayIndex) => (dayIndex + 1) * 86_400 - 1)
      const fillerTimestamps = allTimestamps.filter((_timestamp, dayIndex) => dayIndex % 10 === 5)

      return {
        address: `0x${tokenIndex.toString(16).padStart(4, '0')}`,
        allTimestamps,
        fillerTimestamps
      }
    })
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(async (requests) =>
      createHistoricalPriceResult(requests)
    )
    const loader = createHoldingsValuationLoader()

    const [balance, protocol] = await Promise.all([
      loader.fetchHistoricalPrices(
        tokenRequests.map(({ address, allTimestamps }) => ({
          chainId: 1,
          address,
          timestamps: allTimestamps
        })),
        { resolution: 'utc_day', consumer: 'balance' }
      ),
      loader.fetchHistoricalPrices(
        tokenRequests.map(({ address, fillerTimestamps }) => ({
          chainId: 1,
          address,
          timestamps: fillerTimestamps
        })),
        { resolution: 'utc_day', consumer: 'protocol-return' }
      )
    ])

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)
    const providerPricePointCounts = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls
      .map(([requests]) =>
        (requests as Array<{ timestamps: number[] }>).reduce((total, { timestamps }) => total + timestamps.length, 0)
      )
      .toSorted((left, right) => left - right)
    expect(providerPricePointCounts).toEqual([300, 3_030])
    expect(
      tokenRequests.every(({ address, allTimestamps }) => {
        const returnedTimestamps = Array.from(balance.get(`ethereum:${address}`)?.keys() ?? [])
        return returnedTimestamps.length === allTimestamps.length
      })
    ).toBe(true)
    expect(
      tokenRequests.every(({ address, fillerTimestamps }) => {
        const returnedTimestamps = Array.from(protocol.get(`ethereum:${address}`)?.keys() ?? [])
        return returnedTimestamps.length === fillerTimestamps.length
      })
    ).toBe(true)
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

  it('reserves initial price capacity for protocol work, then uses all three slots for balance', async () => {
    const getDailyRun = (startDay: number): number[] =>
      Array.from({ length: 150 }, (_value, index) => (startDay + index + 1) * 86_400 - 1)
    const balanceTimestamps = [...getDailyRun(0), ...getDailyRun(151), ...getDailyRun(302)]
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
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(3)

    const protocolRequests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[1]?.[0] ?? []
    protocolResult.resolve(createHistoricalPriceResult(protocolRequests))
    await protocolPromise
    await flushMicrotasks()
    expect(settled).toEqual({ protocol: true, balance: false })
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(4)

    const firstBalanceRequests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[0]?.[0] ?? []
    balanceFirstResult.resolve(createHistoricalPriceResult(firstBalanceRequests))
    await flushMicrotasks()
    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(4)

    const secondBalanceRequests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[2]?.[0] ?? []
    balanceSecondResult.resolve(createHistoricalPriceResult(secondBalanceRequests))

    const thirdBalanceRequests = providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls[3]?.[0] ?? []
    balanceThirdResult.resolve(createHistoricalPriceResult(thirdBalanceRequests))
    const balance = await balancePromise
    expect(settled).toEqual({ protocol: true, balance: true })
    expect(Array.from(balance.get('ethereum:0xaaa')?.keys() ?? [])).toEqual(balanceTimestamps)
  })

  it('aggregates undersized daily runs instead of dispatching one provider call per run', async () => {
    const largeRun = Array.from({ length: 150 }, (_value, index) => (index + 1) * 86_400 - 1)
    const smallRuns = Array.from({ length: 30 }, (_value, runIndex) =>
      Array.from({ length: 2 }, (_unused, dayIndex) => (200 + runIndex * 3 + dayIndex) * 86_400 - 1)
    ).flat()
    const timestamps = [...largeRun, ...smallRuns]
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(async (requests) =>
      createHistoricalPriceResult(requests)
    )
    const loader = createHoldingsValuationLoader()

    const prices = await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps }], {
      resolution: 'utc_day',
      consumer: 'balance'
    })

    expect(providerMocks.fetchHistoricalPricesForTokenTimestamps).toHaveBeenCalledTimes(2)
    expect(
      providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls.map(
        ([requests]) => (requests as Array<{ timestamps: number[] }>)[0]?.timestamps.length
      )
    ).toEqual([150, 60])
    expect(prices.get('ethereum:0xaaa')?.size).toBe(timestamps.length)
  })

  it('dispatches the longest balance price batches first without changing requested points', async () => {
    const getDailyRun = (startDay: number, length: number): number[] =>
      Array.from({ length }, (_value, index) => (startDay + index + 1) * 86_400 - 1)
    const timestamps = [...getDailyRun(0, 100), ...getDailyRun(101, 200), ...getDailyRun(302, 20)]
    providerMocks.fetchHistoricalPricesForTokenTimestamps.mockImplementation(async (requests) =>
      createHistoricalPriceResult(requests)
    )
    const loader = createHoldingsValuationLoader()

    const prices = await loader.fetchHistoricalPrices([{ chainId: 1, address: '0xAAA', timestamps }], {
      resolution: 'utc_day',
      consumer: 'balance'
    })

    expect(
      providerMocks.fetchHistoricalPricesForTokenTimestamps.mock.calls.map(
        ([requests]) => (requests as Array<{ timestamps: number[] }>)[0]?.timestamps.length
      )
    ).toEqual([200, 100, 20])
    expect(prices.get('ethereum:0xaaa')?.size).toBe(timestamps.length)
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
