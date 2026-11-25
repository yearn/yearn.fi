import type { TTenderlyFundRequest } from '@shared/types/localFork'
import {
  createAnvilSnapshot,
  fundAnvilWallet,
  getLocalAnvilRpcUri,
  increaseAnvilTime,
  readAnvilInstance,
  revertAnvilSnapshot
} from '@shared/utils/anvilPanel'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const RPC_URI = 'http://127.0.0.1:8547/'
const walletAddress = '0x1111111111111111111111111111111111111111'
const tokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const fetchMock = vi.fn<typeof fetch>()

function rpcResult(result: unknown): Response {
  return Response.json({ jsonrpc: '2.0', id: 1, result })
}

function requests(): unknown[] {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Anvil panel RPC', () => {
  it.each(['http://localhost:8545', 'http://127.0.0.1:8547', 'http://[::1]:8545'])(
    'allows an explicit local RPC at %s',
    (url) => expect(getLocalAnvilRpcUri(url)).toBe(`${url}/`)
  )

  it.each([
    'https://example.com',
    'http://localhost.example.com',
    'http://user@127.0.0.1:8547',
    'http://localhost/rpc'
  ])('rejects a non-local or ambiguous RPC at %s', async (url) => {
    expect(getLocalAnvilRpcUri(url)).toBeUndefined()
    await expect(readAnvilInstance(url, 1337)).rejects.toThrow('localhost RPC')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('only accepts Anvil metadata for the configured execution chain', async () => {
    fetchMock.mockResolvedValueOnce(rpcResult({ chainId: 1337, instanceId: '0x123' }))
    await expect(readAnvilInstance(RPC_URI, 1337)).resolves.toBe('0x123')
    expect(fetchMock).toHaveBeenCalledWith(RPC_URI, expect.objectContaining({ redirect: 'error' }))

    fetchMock.mockResolvedValueOnce(rpcResult({ chainId: '0x539', instanceId: '0x123' }))
    await expect(readAnvilInstance(RPC_URI, 1337)).resolves.toBe('0x123')

    fetchMock.mockResolvedValueOnce(rpcResult({ chainId: 31337, instanceId: '0x123' }))
    await expect(readAnvilInstance(RPC_URI, 1337)).rejects.toThrow('does not match chain 1337')
  })

  it('creates a baseline record and reports a failed revert', async () => {
    fetchMock.mockResolvedValueOnce(rpcResult('0x1')).mockResolvedValueOnce(rpcResult(false))

    await expect(createAnvilSnapshot(RPC_URI, 1337, { canonicalChainId: 1, isBaseline: true })).resolves.toMatchObject({
      snapshotId: '0x1',
      canonicalChainId: 1,
      executionChainId: 1337,
      kind: 'baseline',
      label: expect.stringMatching(/^Baseline /),
      lastKnownStatus: 'valid'
    })
    await expect(revertAnvilSnapshot(RPC_URI, '0x1')).rejects.toThrow('Anvil rejected revert for snapshot 0x1')

    expect(requests()).toEqual([
      expect.objectContaining({ method: 'evm_snapshot', params: [] }),
      expect.objectContaining({ method: 'evm_revert', params: ['0x1'] })
    ])
  })

  it('mines a block after advancing time when requested', async () => {
    fetchMock.mockResolvedValueOnce(rpcResult(3600)).mockResolvedValueOnce(rpcResult('0x0'))

    await increaseAnvilTime(RPC_URI, { seconds: 3600, mineBlock: true })
    expect(requests()).toEqual([
      expect.objectContaining({ method: 'evm_increaseTime', params: ['0xe10'] }),
      expect.objectContaining({ method: 'evm_mine', params: [] })
    ])
  })

  it('adds ETH to the current balance and sets an ERC-20 balance in base units', async () => {
    const native: TTenderlyFundRequest = {
      canonicalChainId: 1,
      walletAddress,
      assetKind: 'native',
      decimals: 18,
      symbol: 'ETH',
      amount: '1.5'
    }
    fetchMock
      .mockResolvedValueOnce(rpcResult('0x1'))
      .mockResolvedValueOnce(rpcResult(null))
      .mockResolvedValueOnce(rpcResult(null))

    await fundAnvilWallet(RPC_URI, native)
    await fundAnvilWallet(RPC_URI, {
      ...native,
      assetKind: 'erc20',
      tokenAddress,
      decimals: 6,
      symbol: 'USDC',
      amount: '1.5'
    })
    expect(requests()).toEqual([
      expect.objectContaining({ method: 'eth_getBalance', params: [walletAddress, 'latest'] }),
      expect.objectContaining({ method: 'anvil_setBalance', params: [walletAddress, '0x14d1120d7b160001'] }),
      expect.objectContaining({ method: 'anvil_dealERC20', params: [walletAddress, tokenAddress, '0x16e360'] })
    ])
  })
})
