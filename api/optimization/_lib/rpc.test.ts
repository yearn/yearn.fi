import { ethers } from 'ethers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchVaultOnChainState, getArchiveRpcEndpoints } from './rpc'

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
})

describe('getArchiveRpcEndpoints', () => {
  it('uses the server-side chain RPC env var for archive reads without accessing legacy RPC env vars', () => {
    const accessedEnvKeys: string[] = []
    const legacyDrpcEnvVar = ['MAINNET', 'DRPC'].join('_')
    const legacyEthereumRpcEnvVar = ['ETHEREUM', 'RPC', 'URL'].join('_')
    const env = new Proxy(
      {
        RPC_URI_FOR_1: 'https://rpc.yearn.fi/chain/1',
        [legacyEthereumRpcEnvVar]: 'https://legacy-rpc.example',
        [legacyDrpcEnvVar]: 'https://drpc.example'
      },
      {
        get(target, property) {
          accessedEnvKeys.push(String(property))
          return target[property as keyof typeof target]
        }
      }
    )

    const endpoints = getArchiveRpcEndpoints(1, env)

    expect(endpoints[0]).toBe('https://rpc.yearn.fi/chain/1')
    expect(accessedEnvKeys).not.toContain(legacyEthereumRpcEnvVar)
    expect(accessedEnvKeys).not.toContain(legacyDrpcEnvVar)
  })
})
