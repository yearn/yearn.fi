import { describe, expect, it } from 'vitest'
import { buildSnapshotBackedVault, isSnapshotLikelyV3Vault } from './snapshotBackedVault'

describe('snapshotBackedVault', () => {
  it('treats yield splitter snapshots without apiVersion metadata as v3 vaults', () => {
    const snapshot = {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 1,
      name: 'Yield Splitter',
      symbol: 'ysUSDC',
      decimals: 18,
      asset: {
        address: '0x2222222222222222222222222222222222222222',
        name: 'USDC',
        symbol: 'USDC',
        decimals: 6
      },
      totalAssets: '0',
      tvl: { close: 0 },
      apy: null,
      fees: null,
      risk: null,
      performance: {},
      composition: [],
      debts: [],
      strategies: [],
      yieldSplitter: {
        enabled: true,
        sourceVaultAddress: '0x3333333333333333333333333333333333333333',
        wantVaultAddress: '0x4444444444444444444444444444444444444444'
      }
    } as any

    expect(isSnapshotLikelyV3Vault(snapshot)).toBe(true)
    expect(buildSnapshotBackedVault(snapshot).v3).toBe(true)
  })
})
