import { encodeAbiParameters } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchVaultOnChainState } from './rpc'

const VAULT_ADDRESS = '0x1111111111111111111111111111111111111111'
const STRATEGY_ADDRESSES = ['0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333']

describe('fetchVaultOnChainState', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('decodes multicall bytes[] results from the array body offsets', async () => {
    const totalAssets = 1000n
    const firstDebt = 250n
    const secondDebt = 150n

    const result = encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes[]' }],
      [
        123n,
        [
          encodeAbiParameters([{ type: 'uint256' }], [totalAssets]),
          encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
            [0n, 0n, firstDebt, 0n]
          ),
          encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
            [0n, 0n, secondDebt, 0n]
          )
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
})
