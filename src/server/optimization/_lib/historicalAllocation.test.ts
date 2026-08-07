import { describe, expect, it, vi } from 'vitest'

const { fetchCurrentStrategyMetadataMock, fetchHistoricalStrategyUniverseMock, fetchStatesMock } = vi.hoisted(() => ({
  fetchCurrentStrategyMetadataMock: vi.fn(),
  fetchHistoricalStrategyUniverseMock: vi.fn(),
  fetchStatesMock: vi.fn()
}))

vi.mock('./envio', () => ({
  fetchHistoricalStrategyUniverse: fetchHistoricalStrategyUniverseMock
}))

vi.mock('./rpc', () => ({
  fetchVaultOnChainStatesAtTimestamps: fetchStatesMock
}))

vi.mock('./strategyMetadata', () => ({
  fetchCurrentStrategyMetadata: fetchCurrentStrategyMetadataMock
}))

import { fetchHistoricalAllocationGroup } from './historicalAllocation'

const VAULT = '0x1111111111111111111111111111111111111111'
const OPTIMIZED = '0x2222222222222222222222222222222222222222'
const OMITTED = '0x3333333333333333333333333333333333333333'

describe('fetchHistoricalAllocationGroup', () => {
  it('batches timestamp reads and leaves records with insufficient lifecycle coverage unavailable', async () => {
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.example/graphql')
    fetchHistoricalStrategyUniverseMock.mockResolvedValue({
      strategyAddresses: [OPTIMIZED, OMITTED],
      firstSeenTimestampByAddress: {
        [OPTIMIZED]: 100,
        [OMITTED]: 20
      },
      complete: true,
      source: 'envio-strategy-changed',
      eventCount: 2
    })
    fetchStatesMock.mockResolvedValue([
      {
        blockNumber: 123,
        blockTimestamp: 199,
        totalAssets: 1000n,
        strategyDebts: new Map([
          [OPTIMIZED, 400n],
          [OMITTED, 500n]
        ]),
        unallocatedBps: 1000
      }
    ])
    fetchCurrentStrategyMetadataMock.mockResolvedValue(
      new Map([
        [OPTIMIZED, { name: 'Current optimized name', source: 'current-metadata-catalog' }],
        [OMITTED, { name: 'Current omitted name', source: 'current-metadata-catalog' }]
      ])
    )

    const availableRequest = {
      chainId: 1,
      vault: VAULT,
      timestampUtc: '1970-01-01 00:03:20 UTC',
      optimizerStrategies: [{ strategy: OPTIMIZED }]
    }
    const unavailableRequest = {
      chainId: 1,
      vault: VAULT,
      timestampUtc: '1970-01-01 00:00:50 UTC',
      optimizerStrategies: [{ strategy: OPTIMIZED }]
    }
    const snapshots = await fetchHistoricalAllocationGroup([availableRequest, unavailableRequest])
    const values = Array.from(snapshots.values())

    expect(fetchStatesMock).toHaveBeenCalledWith(1, VAULT, [
      {
        timestamp: 200,
        strategyAddresses: [OPTIMIZED, OMITTED]
      }
    ])
    expect(values[0]).toMatchObject({
      blockNumber: 123,
      complete: true,
      strategies: [
        {
          address: OPTIMIZED,
          name: 'Current optimized name',
          nameSource: 'current-metadata-catalog',
          currentBps: 4000
        },
        {
          address: OMITTED,
          name: 'Current omitted name',
          nameSource: 'current-metadata-catalog',
          currentBps: 5000
        }
      ],
      unallocatedBps: 1000
    })
    expect(values[1]).toBeNull()
  })
})
