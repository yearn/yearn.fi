import {
  discoverWalletVaults,
  inspectWalletCandidate,
  parseWalletCandidates,
  parseYearnAllocators
} from '@erc4626/lib/vaultDiscovery'
import { AbiDecodingZeroDataError, type PublicClient, zeroAddress } from 'viem'
import { describe, expect, it, vi } from 'vitest'

const vault = '0x1111111111111111111111111111111111111111' as const
const asset = '0x2222222222222222222222222222222222222222' as const
const owner = '0x3333333333333333333333333333333333333333' as const
const candidate = { address: vault, chainId: 1 }
const success = (result: unknown) => ({ status: 'success', result })
const client = (results: unknown[]) =>
  ({ multicall: vi.fn().mockResolvedValue(results) }) as unknown as Pick<PublicClient, 'multicall'>
const readings = (balance = 5n) => [
  success(asset),
  success(balance),
  success(0n),
  success(18),
  success('Unpriced vault'),
  success('SHARE')
]

describe('wallet discovery', () => {
  it('includes unpriced tokens, deduplicates, and excludes empty, native and unsupported entries', () => {
    expect(
      parseWalletCandidates([
        { token: vault, chainId: 1, amount: '1', price: 0 },
        { token: vault, chainId: 1, amount: '2' },
        { token: asset, chainId: 1, amount: '0' },
        { token: zeroAddress, chainId: 1, amount: '1' },
        { token: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', chainId: 1, amount: '1' },
        { token: vault, chainId: 146, amount: '1' }
      ])
    ).toEqual([candidate])
  })
  it('rejects malformed data instead of reporting an empty wallet', () => {
    expect(() => parseWalletCandidates({ error: 'unavailable' })).toThrow()
    expect(() => parseWalletCandidates([{ token: vault, chainId: 1, amount: 'bad' }])).toThrow()
  })
  it('uses current on-chain shares and tolerates missing cosmetic metadata', async () => {
    const results = readings()
    results[4] = { status: 'failure', error: new Error('name unavailable') } as never
    expect(await inspectWalletCandidate(client(results), candidate, owner)).toMatchObject({
      unreadable: false,
      vault: { shares: 5n, name: 'ERC-4626 vault' }
    })
    expect(await inspectWalletCandidate(client(readings(0n)), candidate, owner)).toEqual({ unreadable: false })
  })
  it('distinguishes an ordinary ERC20 from a failed RPC check', async () => {
    const ordinary = readings()
    ordinary[0] = { status: 'failure', error: new AbiDecodingZeroDataError() } as never
    expect(await inspectWalletCandidate(client(ordinary), candidate, owner)).toEqual({ unreadable: false })
    const unavailable = readings()
    unavailable[0] = { status: 'failure', error: new Error('RPC timeout') } as never
    expect(await inspectWalletCandidate(client(unavailable), candidate, owner)).toEqual({ unreadable: true })
  })
  it('reports scan limits and unavailable clients', async () => {
    const result = await discoverWalletVaults(
      Array.from({ length: 501 }, () => candidate),
      owner,
      () => undefined
    )
    expect(result).toEqual({ vaults: [], unreadable: 500, omitted: 1 })
  })
  it('stops scanning when the account query is cancelled', async () => {
    const abort = new AbortController()
    abort.abort()
    const rpc = client(readings())
    await expect(discoverWalletVaults([candidate], owner, () => rpc, abort.signal)).rejects.toThrow()
    expect(rpc.multicall).not.toHaveBeenCalled()
  })
})

describe('Yearn allocator discovery', () => {
  const row = {
    address: vault,
    chainId: 1,
    name: 'Allocator',
    symbol: 'yvTOKEN',
    origin: 'yearn',
    kind: 'Multi Strategy',
    apiVersion: '3.0.4',
    asset: { symbol: 'TOKEN' }
  }
  it('only includes supported, visible V3 allocators, retaining retired vaults for withdrawal', () => {
    const result = parseYearnAllocators([
      { ...row, name: 'Old', isRetired: true },
      row,
      { ...row, isHidden: true },
      { ...row, apiVersion: '0.4.3' },
      { ...row, kind: 'Single Strategy' },
      { ...row, origin: 'other' },
      { ...row, chainId: 146 }
    ])
    expect(result.map((item) => [item.name, item.retired])).toEqual([
      ['Allocator', false],
      ['Old', true]
    ])
    expect(result[0].assetSymbol).toBe('TOKEN')
  })
  it('rejects service errors rather than presenting an empty catalog', () => {
    expect(() => parseYearnAllocators({ error: 'bad' })).toThrow()
  })
})
