import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHistoricalStrategyUniverse } from './envio'

const VAULT = '0x1111111111111111111111111111111111111111'
const FIRST_STRATEGY = '0x2222222222222222222222222222222222222222'
const SECOND_STRATEGY = '0x3333333333333333333333333333333333333333'

describe('fetchHistoricalStrategyUniverse', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deduplicates lifecycle events and confirms complete indexed coverage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          strategyChanges: [
            { strategy: FIRST_STRATEGY, change_type: '1', blockNumber: 1, blockTimestamp: 100 },
            { strategy: FIRST_STRATEGY, change_type: '2', blockNumber: 2, blockTimestamp: 200 },
            { strategy: SECOND_STRATEGY, change_type: '1', blockNumber: 3, blockTimestamp: 300 }
          ]
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const universe = await fetchHistoricalStrategyUniverse('https://envio.example/graphql', VAULT, 1, 400, [
      FIRST_STRATEGY,
      SECOND_STRATEGY
    ])

    expect(universe).toEqual({
      strategyAddresses: [FIRST_STRATEGY.toLowerCase(), SECOND_STRATEGY.toLowerCase()],
      firstSeenTimestampByAddress: {
        [FIRST_STRATEGY.toLowerCase()]: 100,
        [SECOND_STRATEGY.toLowerCase()]: 300
      },
      complete: true,
      source: 'envio-strategy-changed',
      eventCount: 3
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('marks lifecycle coverage incomplete when an optimizer strategy lacks an indexed add event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            strategyChanges: [{ strategy: FIRST_STRATEGY, change_type: '2' }]
          }
        })
      })
    )

    await expect(
      fetchHistoricalStrategyUniverse('https://envio.example/graphql', VAULT, 1, 400, [FIRST_STRATEGY, SECOND_STRATEGY])
    ).resolves.toMatchObject({
      complete: false,
      eventCount: 1
    })
  })
})
