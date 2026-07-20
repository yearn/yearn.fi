import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TIMELOCK_ADDRESS } from './config'
import { clearTimelockStrategiesCache, fetchPendingTimelockStrategies } from './rpc'

const OPERATION_ID = '0x5dac358a2f25b7148ebb9bca035dc4739fae4092086f4e8f98cc201f7e773a98'
const VAULT = '0x696d02Db93291651ED510704c9b286841d506987'
const OTHER_VAULT = '0x1111111111111111111111111111111111111111'
const STRATEGY = '0x908244B6ef0e52911a380a5454aEC0743598Fb20'
const ADD_STRATEGY_DATA = '0xde7aeb41000000000000000000000000908244b6ef0e52911a380a5454aec0743598fb20'
const UPDATE_MAX_DEBT_DATA =
  '0xb9ddcd68000000000000000000000000908244b6ef0e52911a380a5454aec0743598fb2000000000000000000000000000000000000000000000000000005af3107a4000'
const TX_HASH = '0xa6e8a54c3ff514951bca921cc38af55278980937816e5d04cd2d88fcf406199c'

function createMockClient(): any {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(251_900_00n),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1_780_000_000n }),
    getLogs: vi.fn(({ event }) => {
      if ((event as { name?: string }).name !== 'CallScheduled') {
        return Promise.resolve([])
      }

      return Promise.resolve([
        {
          args: {
            id: OPERATION_ID,
            index: 0n,
            target: VAULT,
            data: ADD_STRATEGY_DATA,
            delay: 604_800n
          },
          blockNumber: 251_882_99n,
          logIndex: 10,
          transactionHash: TX_HASH
        },
        {
          args: {
            id: OPERATION_ID,
            index: 2n,
            target: OTHER_VAULT,
            data: ADD_STRATEGY_DATA,
            delay: 604_800n
          },
          blockNumber: 251_883_00n,
          logIndex: 12,
          transactionHash: TX_HASH
        },
        {
          args: {
            id: OPERATION_ID,
            index: 1n,
            target: VAULT,
            data: UPDATE_MAX_DEBT_DATA,
            delay: 604_800n
          },
          blockNumber: 251_882_99n,
          logIndex: 11,
          transactionHash: TX_HASH
        }
      ])
    }),
    readContract: vi.fn(({ functionName }) => {
      const responses: Record<string, unknown> = {
        isOperationPending: true,
        isOperationReady: true,
        isOperationDone: false,
        getTimestamp: 1_780_509_347n,
        name: 'Base Yearn Morpho OG USDC',
        symbol: 'ysUSDC'
      }

      return Promise.resolve(responses[functionName])
    })
  }
}

describe('fetchPendingTimelockStrategies', () => {
  beforeEach(() => {
    clearTimelockStrategiesCache()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('fetches logs in bounded chunks and returns decoded pending strategies', async () => {
    const client = createMockClient()

    const items = await fetchPendingTimelockStrategies({ chainId: 1, vaultAddress: VAULT, client, nowSeconds: 1 })

    expect(items[0]).toMatchObject({
      strategyAddress: STRATEGY,
      strategyName: 'Base Yearn Morpho OG USDC',
      status: 'ready',
      maxDebtRaw: '100000000000000'
    })
    expect(client.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TIMELOCK_ADDRESS,
        fromBlock: expect.any(BigInt),
        toBlock: expect.any(BigInt)
      })
    )
    expect(client.getLogs.mock.calls.length).toBeGreaterThan(3)
    expect(new Set(client.getLogs.mock.calls.map(([params]: any[]) => params.event.name))).toEqual(
      new Set(['CallScheduled'])
    )
    expect(client.getBlock).toHaveBeenCalledTimes(1)
    expect(client.getBlock).toHaveBeenCalledWith({ blockNumber: 251_882_99n })
  })

  it('uses the request cache for repeat lookups', async () => {
    const client = createMockClient()

    await fetchPendingTimelockStrategies({ chainId: 1, vaultAddress: VAULT, client, nowSeconds: 1 })
    await fetchPendingTimelockStrategies({ chainId: 1, vaultAddress: VAULT, client, nowSeconds: 2 })

    expect(client.getBlockNumber).toHaveBeenCalledTimes(1)
  })

  it('returns empty results when RPC is missing', async () => {
    vi.stubEnv('RPC_URI_FOR_1', '')
    vi.stubEnv('NEXT_PUBLIC_RPC_URI_FOR_1', '')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(fetchPendingTimelockStrategies({ chainId: 1, vaultAddress: VAULT })).resolves.toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      'Missing RPC_URI_FOR_1 or NEXT_PUBLIC_RPC_URI_FOR_1; pending timelock strategy lookup skipped.'
    )
  })

  it('returns empty results for unsupported chains', async () => {
    await expect(
      fetchPendingTimelockStrategies({ chainId: 250, vaultAddress: VAULT, client: createMockClient() })
    ).resolves.toEqual([])
  })
})
