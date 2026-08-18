import { ethers } from 'ethers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchVaultOnChainState, fetchVaultOnChainStatesAtTimestamps, getAllRpcEndpoints } from './rpc'

const VAULT_ADDRESS = '0x1111111111111111111111111111111111111111'
const STRATEGY_ADDRESSES = ['0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333']

describe('fetchVaultOnChainState', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('prefers a configured dedicated archive endpoint', () => {
    vi.stubEnv('OPTIMIZATION_ARCHIVE_RPC_URL_1', 'https://archive.example')

    expect(getAllRpcEndpoints(1)[0]).toBe('https://archive.example')
  })

  it('decodes multicall bytes[] results from the array body offsets', async () => {
    const totalAssets = ethers.BigNumber.from(1000)
    const firstDebt = ethers.BigNumber.from(250)
    const secondDebt = ethers.BigNumber.from(150)

    const result = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes[]'],
      [
        123,
        [
          ethers.utils.defaultAbiCoder.encode(['uint256'], [totalAssets]),
          ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256', 'uint256'], [0, 0, firstDebt, 0]),
          ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256', 'uint256'], [0, 0, secondDebt, 0])
        ]
      ]
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, result })
    })
    vi.stubGlobal('fetch', fetchMock)

    const state = await fetchVaultOnChainState(1, VAULT_ADDRESS, STRATEGY_ADDRESSES)

    expect(state.totalAssets).toBe(1000n)
    expect(Object.fromEntries(state.strategyDebts)).toEqual({
      [STRATEGY_ADDRESSES[0].toLowerCase()]: 250n,
      [STRATEGY_ADDRESSES[1].toLowerCase()]: 150n
    })
    expect(state.unallocatedBps).toBe(6000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('resolves the last block at or before a timestamp and reads one historical multicall', async () => {
    const result = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes[]'],
      [
        5,
        [
          ethers.utils.defaultAbiCoder.encode(['uint256'], [1000]),
          ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256', 'uint256'], [0, 0, 400, 0]),
          ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256', 'uint256'], [0, 0, 100, 0])
        ]
      ]
    )
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as
        | { id: number; method: string; params: string[] }
        | Array<{ id: number; method: string; params: string[] }>
      const buildResponse = (request: { id: number; method: string; params: string[] }) => {
        if (request.method === 'eth_call') {
          return { jsonrpc: '2.0', id: request.id, result }
        }

        const requestedBlock = request.params[0] === 'latest' ? 10 : Number(BigInt(request.params[0]))
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            number: `0x${requestedBlock.toString(16)}`,
            timestamp: `0x${(100 + requestedBlock * 10).toString(16)}`
          }
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => (Array.isArray(body) ? body.map(buildResponse) : buildResponse(body))
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const [state] = await fetchVaultOnChainStatesAtTimestamps(1, VAULT_ADDRESS, [
      { timestamp: 155, strategyAddresses: STRATEGY_ADDRESSES }
    ])

    expect(state).toMatchObject({
      blockNumber: 5,
      blockTimestamp: 150,
      totalAssets: 1000n,
      unallocatedBps: 5000
    })
    expect(
      fetchMock.mock.calls.filter(([_url, init]) => {
        const body = JSON.parse(String((init as RequestInit).body))
        return Array.isArray(body) && body.some((request) => request.method === 'eth_call')
      })
    ).toHaveLength(1)
  })
})
