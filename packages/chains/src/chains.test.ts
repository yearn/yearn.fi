import { APP_PROFILES } from '@yearn/chains/profiles'
import { CHAIN_REGISTRY, type TChainRegistration } from '@yearn/chains/registry'
import { getAppRpcUrl } from '@yearn/chains/rpc'
import {
  getAppChain,
  getAppChains,
  getCommonTokens,
  getEnsoRouter,
  getHistoryChainIds,
  getNativeBalanceChains,
  getRoutingChains,
  getRpcBalanceFallbackChainIds,
  getVaultChainIds,
  getVaultFilterChainIds,
  getWrappedNativeAddress
} from '@yearn/chains/selectors'
import { validateChainConfiguration } from '@yearn/chains/validation'
import { mainnet } from 'viem/chains'
import { describe, expect, it } from 'vitest'

const example: TChainRegistration = {
  chain: { ...mainnet, id: 999999, name: 'Example' },
  displayName: 'Example',
  prices: {}
}

describe('chain migration compatibility', () => {
  it('preserves each app scope and order without enabling metadata-only chains', () => {
    expect(getAppChains('yearn').map(({ id }) => id)).toEqual([1, 10, 137, 250, 8453, 42161, 146, 747474, 4663])
    expect(getAppChains('erc4626').map(({ id }) => id)).toEqual([1, 8453, 42161, 10, 137, 4663])
    expect(getAppChains('ybold').map(({ id }) => id)).toEqual([1])
    expect(getAppChain('ybold', 4663)).toBeUndefined()
    expect(getAppChain('yearn', 100)).toBeUndefined()
    expect(getAppChain('erc4626', 999999)).toBeUndefined()
  })
  it('preserves vault-list ordering, history membership and the legacy native-balance scope', () => {
    expect(getVaultChainIds('all')).toEqual([1, 747474, 8453, 10, 4663])
    expect(getVaultChainIds('v2')).toEqual([1, 10, 8453])
    expect(getVaultChainIds('v3')).toEqual([1, 747474, 8453, 4663])
    expect(getVaultFilterChainIds('primary')).toEqual([1, 747474])
    expect(getVaultFilterChainIds('secondary')).toEqual([8453])
    expect(getHistoryChainIds().sort((a, b) => a - b)).toEqual([1, 10, 137, 250, 4663, 8453, 42161, 747474])
    expect(getNativeBalanceChains().map(({ id }) => id)).not.toContain(146)
  })
  it('does not imply Enso support from wallet-chain membership', () => {
    expect(getRoutingChains('yearn').map(({ id }) => id)).toEqual([1, 10, 137, 42161, 8453, 747474, 4663])
    expect(getRpcBalanceFallbackChainIds()).toEqual([250])
    expect(getRoutingChains('erc4626')).toEqual([])
    expect(getRoutingChains('ybold')).toEqual([])
    expect(getEnsoRouter(4663)).toBe('0xCfBAa9Cfce952Ca4F4069874fF1Df8c05e37a3c7')
    expect(getEnsoRouter(146)).toBeUndefined()
  })
  it('shares native wrappers and returns isolated copies of token suggestions', () => {
    const tokens = getCommonTokens('yearn', 'deposit')
    expect(tokens[4663]).toEqual([
      '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
      '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'
    ])
    expect(tokens[4663][1]).toBe(getWrappedNativeAddress(4663))
    tokens[4663].pop()
    expect(getCommonTokens('yearn', 'deposit')[4663]).toHaveLength(2)
    expect(getWrappedNativeAddress(999999)).toBeUndefined()
  })
})

describe('RPC configuration', () => {
  it('uses individual environment values assembled by the host before app defaults', () => {
    const overrides = { 4663: ' https://rpc.example ' }
    expect(getAppRpcUrl('erc4626', 4663, overrides)).toBe('https://rpc.example')
    expect(getAppRpcUrl('erc4626', 1, {})).toBe('https://ethereum-rpc.publicnode.com')
    expect(getAppRpcUrl('ybold', 1, { 1: 'https://ybold.example' })).toBe('https://ybold.example')
    expect(() => getAppRpcUrl('ybold', 4663, overrides)).toThrow('not enabled')
  })
  it('uses defaults for missing or blank per-chain settings', () => {
    expect(getAppRpcUrl('erc4626', 4663, { 4663: ' ' })).toBe('https://rpc.mainnet.chain.robinhood.com')
    expect(getAppRpcUrl('ybold', 1, { 1: undefined })).toBe('https://ethereum-rpc.publicnode.com')
  })
})

describe('offline configuration validation', () => {
  it('validates the current registry and profiles', () => expect(validateChainConfiguration()).toEqual([]))
  it('allows a direct-only chain without prices, Enso or history', () => {
    expect(
      validateChainConfiguration([...CHAIN_REGISTRY, example], {
        ...APP_PROFILES,
        erc4626: [...APP_PROFILES.erc4626, { id: example.chain.id }]
      })
    ).toEqual([])
  })
  it('reports unregistered and duplicate chain IDs', () => {
    expect(validateChainConfiguration(CHAIN_REGISTRY, { ...APP_PROFILES, ybold: [{ id: 999999 }] })).toContain(
      'ybold: unregistered chain 999999'
    )
    expect(
      validateChainConfiguration([...CHAIN_REGISTRY, CHAIN_REGISTRY[0]]).some((message) =>
        message.includes('duplicate chain ID')
      )
    ).toBe(true)
  })
  it('rejects enabled integrations without their metadata', () => {
    const errors = validateChainConfiguration([...CHAIN_REGISTRY, example], {
      ...APP_PROFILES,
      yearn: [...APP_PROFILES.yearn, { id: example.chain.id, history: true, ensoOrder: 7, v3Filter: 'primary' }]
    })
    expect(errors).toEqual(
      expect.arrayContaining([
        'yearn chain 999999: routing enabled without a verified Enso router',
        'yearn chain 999999: history needs identifiers for both supported price providers',
        'yearn chain 999999: V3 filter placement requires V3 vault support'
      ])
    )
  })
  it('does not require pricing providers to share identifiers', () => {
    expect(
      validateChainConfiguration([
        ...CHAIN_REGISTRY,
        { ...example, prices: { 'yearn-prices': 'example', defillama: 'example-network' } }
      ])
    ).toEqual([])
  })
  it('rejects a chain with no RPC default for an enabled app', () => {
    expect(
      validateChainConfiguration(
        [...CHAIN_REGISTRY, { ...example, chain: { ...example.chain, rpcUrls: { default: { http: [] } } } }],
        {
          ...APP_PROFILES,
          erc4626: [...APP_PROFILES.erc4626, { id: example.chain.id }]
        }
      )
    ).toContain('erc4626 chain 999999: missing HTTP(S) RPC default')
  })
})
