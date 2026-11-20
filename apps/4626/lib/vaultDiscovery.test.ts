import {
  discoverWalletVaults,
  filterVisibleWalletVaults,
  inspectWalletCandidate,
  parseHiddenYearnVaultTokens,
  parseIndexedVaults,
  parseWalletCandidates,
  parseYearnAllocators,
  sortVaultChoices
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

describe('indexed vault catalog', () => {
  it('hides STB depositors including joined token names, while retaining unrelated STB tokens', () => {
    const rows = [
      'Katana USDC STB Depositor',
      'Katana WBTCSTB Depositor',
      'katana weth stb depositor',
      'Curve STBT Factory yVault',
      'Sturdy TBTC/SWBTC silo'
    ].map((name, index) => ({
      address: `0x${String(index + 1).padStart(40, '0')}`,
      chainId: 1,
      name,
      asset: { address: asset },
      isHidden: false
    }))
    expect(parseIndexedVaults(rows).map((vault) => vault.name)).toEqual(rows.slice(3).map((vault) => vault.name))
    const metadata = parseIndexedVaults(rows, { includeHidden: true })
    expect(metadata).toHaveLength(5)
    expect(metadata.filter((vault) => vault.hidden).map((vault) => vault.name)).toEqual(
      rows.slice(0, 3).map((vault) => vault.name)
    )
  })
  it('ranks same-chain holdings first, then descending TVL, with missing TVL after genuine zero', () => {
    const rows = [
      { ...candidate, name: 'Large', tvlUsd: 1000 },
      { address: asset, chainId: 1, name: 'Held small', tvlUsd: 10 },
      { address: owner, chainId: 1, name: 'Held large', tvlUsd: 20 },
      { address: asset, chainId: 8453, name: 'Other chain', tvlUsd: 500 },
      { ...candidate, chainId: 10, name: 'Zero', tvlUsd: 0 },
      { ...candidate, chainId: 137, name: 'Unavailable' },
      { address: asset, chainId: 42161, name: 'Held unavailable' }
    ].map((row) => ({ ...row, symbol: 'SHARES' }))
    const sorted = sortVaultChoices(rows, [
      { address: asset, chainId: 1 },
      { address: owner, chainId: 1 },
      { address: asset, chainId: 42161 }
    ])
    expect(sorted.map((row) => row.name)).toEqual([
      'Held large',
      'Held small',
      'Held unavailable',
      'Large',
      'Other chain',
      'Zero',
      'Unavailable'
    ])
    expect(rows[0].name).toBe('Large')
    expect(sorted.at(-1)?.tvlUsd).toBeUndefined()
  })
  it('retains valid catalog TVL and does not turn missing or invalid TVL into zero', () => {
    const base = { ...candidate, name: 'Vault', asset: { address: asset } }
    const parsed = parseIndexedVaults([
      base,
      { ...base, chainId: 10, tvl: 0 },
      { ...base, chainId: 137, tvl: 123.5 },
      { ...base, chainId: 8453, tvl: -1 }
    ])
    expect(parsed.find((row) => row.chainId === 1)?.tvlUsd).toBeUndefined()
    expect(parsed.find((row) => row.chainId === 10)?.tvlUsd).toBe(0)
    expect(parsed.find((row) => row.chainId === 137)?.tvlUsd).toBe(123.5)
    expect(parsed.find((row) => row.chainId === 8453)?.tvlUsd).toBeUndefined()
  })
  it('keeps external candidates with unknown origins and distinguishes Yearn single asset, LP and legacy entries', () => {
    const base = { address: vault, chainId: 1, name: 'Vault', asset: { address: asset, symbol: 'TOKEN' } }
    const choices = parseIndexedVaults([
      { ...base, name: 'External', origin: null },
      { ...base, address: asset, origin: 'yearn', apiVersion: '3.0.4', kind: 'Multi Strategy' },
      { ...base, address: owner, origin: 'yearn', apiVersion: '0.4.6', kind: 'Legacy', type: 'Automated Yearn Vault' },
      { ...base, chainId: 10, origin: 'yearn', apiVersion: '3.0.4', kind: 'Single Strategy', isRetired: true },
      { ...base, chainId: 137, origin: 'yearn', apiVersion: '0.4.6', kind: 'Legacy' },
      { ...base, chainId: 146 },
      { ...base, chainId: 8453, isHidden: true },
      { ...base, asset: null }
    ])
    expect(choices).toHaveLength(5)
    expect(choices.find((choice) => choice.name === 'External')).toMatchObject({
      product: 'other',
      origin: undefined,
      legacy: false
    })
    expect(choices.find((choice) => choice.address === asset)).toMatchObject({ product: 'single', strategy: false })
    expect(choices.find((choice) => choice.address === owner)).toMatchObject({
      product: 'lp',
      legacy: true,
      factory: true
    })
    expect(choices.find((choice) => choice.chainId === 10)).toMatchObject({
      product: 'single',
      strategy: true,
      retired: true
    })
    expect(choices.find((choice) => choice.chainId === 137)).toMatchObject({ product: 'legacy', legacy: true })
  })
  it('rejects an unavailable catalog rather than treating it as empty', () => {
    expect(() => parseIndexedVaults({ error: 'unavailable' })).toThrow()
  })
})

describe('wallet discovery', () => {
  it('checks indexed factory holdings with token and PPS instead of ERC-4626 methods', async () => {
    const rpc = client([
      success(asset),
      success(5n),
      success(10n ** 18n),
      success(18),
      success('Factory'),
      success('LP')
    ])
    const result = await discoverWalletVaults([candidate], owner, () => rpc, undefined, [
      { ...candidate, name: 'Factory', symbol: 'LP', factory: true }
    ])
    expect(result.vaults).toEqual([expect.objectContaining({ ...candidate, factory: true, shares: 5n })])
    const calls = vi.mocked(rpc.multicall).mock.calls[0][0].contracts as readonly { functionName: string }[]
    expect(calls.map((call) => call.functionName)).toEqual([
      'token',
      'balanceOf',
      'pricePerShare',
      'decimals',
      'name',
      'symbol'
    ])
  })
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

describe('wallet vault visibility', () => {
  it('hides STB depositor holdings even when they are not marked hidden by the catalog', () => {
    const holdings = [
      { ...candidate, name: 'Katana USDC STB Depositor' },
      { address: asset, chainId: 8453, name: 'Katana WETHSTB Depositor' },
      { address: owner, chainId: 1, name: 'Curve STBT Factory yVault' }
    ]
    expect(filterVisibleWalletVaults(holdings, [])).toEqual(holdings.slice(2))
  })
  it('hides vault and staking-token holdings only on their declared chain', () => {
    const hiddenAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const
    const hidden = parseHiddenYearnVaultTokens([
      { address: hiddenAddress, chainId: 1, isHidden: true, staking: { address: asset, available: false } }
    ])
    const holdings = [
      { address: `0x${hiddenAddress.slice(2).toUpperCase()}` as typeof hiddenAddress, chainId: 1 },
      { address: asset, chainId: 1 },
      { address: hiddenAddress, chainId: 8453 },
      { address: vault, chainId: 1 }
    ]
    expect(filterVisibleWalletVaults(holdings, hidden)).toEqual(holdings.slice(2))
  })
  it('preserves retired, visible and uncatalogued external vaults without consulting prices', () => {
    const hidden = parseHiddenYearnVaultTokens([
      { address: vault, chainId: 1, isHidden: false, isRetired: true },
      { address: asset, chainId: 1 },
      { address: owner, chainId: 1, isHidden: null }
    ])
    const holdings = [candidate, { address: asset, chainId: 1 }, { address: owner, chainId: 1 }]
    expect(filterVisibleWalletVaults(holdings, hidden)).toEqual(holdings)
  })
  it('includes hidden single-strategy and older vaults, independently of the allocator picker filter', () => {
    expect(
      parseHiddenYearnVaultTokens([
        {
          address: vault,
          chainId: 1,
          isHidden: true,
          apiVersion: '0.4.3',
          kind: 'Single Strategy',
          staking: { address: zeroAddress }
        },
        { address: asset, chainId: 8453, isHidden: true, staking: null },
        { address: owner, chainId: 146, isHidden: true }
      ])
    ).toEqual([candidate, { address: asset, chainId: 8453 }])
  })
  it('does not silently accept a failed or malformed visibility response', () => {
    expect(() => parseHiddenYearnVaultTokens({ error: 'unavailable' })).toThrow()
    expect(() => parseHiddenYearnVaultTokens([{ address: 'invalid', chainId: 1, isHidden: true }])).toThrow()
  })
})
