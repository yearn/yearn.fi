import { ethers } from 'ethers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchVaultOnChainState, MAX_VAULT_STATE_STRATEGIES } from './rpc'

const VAULT_ADDRESS = '0x1111111111111111111111111111111111111111'
const STRATEGY_ADDRESSES = ['0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333']

describe('fetchVaultOnChainState', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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

  it('rejects strategy arrays over the shared maximum before RPC execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchVaultOnChainState(
        1,
        VAULT_ADDRESS,
        Array.from(
          { length: MAX_VAULT_STATE_STRATEGIES + 1 },
          (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`
        )
      )
    ).rejects.toThrow(`Too many strategy addresses: maximum ${MAX_VAULT_STATE_STRATEGIES}`)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not run sequential fallback for larger accepted strategy arrays', async () => {
    const strategies = Array.from({ length: 9 }, (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'multicall failed' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchVaultOnChainState(1, VAULT_ADDRESS, strategies)).rejects.toThrow(
      'Too many strategies for sequential fallback: maximum 8'
    )

    expect(fetchMock).toHaveBeenCalledTimes(4)
    fetchMock.mock.calls.forEach((call) => {
      const body = JSON.parse(String(call[1].body))
      expect(body.params[0].to).toBe('0xcA11bde05977b3631167028862bE2a173976CA11')
    })
  })
})
