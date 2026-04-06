import { describe, expect, it } from 'vitest'
import type { TTenderlyFundRequest } from '../src/components/shared/types/tenderly'
import {
  buildTenderlyPanelStatus,
  buildTenderlyRevertResponse,
  buildTenderlySnapshotRecord,
  parseTenderlyServerChains,
  resolveTenderlyFundRpcRequest
} from './tenderly.helpers'

describe('parseTenderlyServerChains', () => {
  it('parses configured Tenderly chains from environment variables', () => {
    expect(
      parseTenderlyServerChains({
        VITE_TENDERLY_MODE: 'true',
        VITE_TENDERLY_CHAIN_ID_FOR_1: '694201',
        VITE_TENDERLY_RPC_URI_FOR_1: 'https://public.rpc',
        TENDERLY_ADMIN_RPC_URI_FOR_1: 'https://admin.rpc'
      })
    ).toEqual([
      {
        canonicalChainId: 1,
        canonicalChainName: 'Ethereum',
        executionChainId: 694201,
        rpcUri: 'https://public.rpc',
        adminRpcUri: 'https://admin.rpc'
      }
    ])
  })
})

describe('buildTenderlyPanelStatus', () => {
  it('reports admin availability per configured chain', () => {
    expect(
      buildTenderlyPanelStatus({
        VITE_TENDERLY_MODE: 'true',
        VITE_TENDERLY_CHAIN_ID_FOR_1: '694201',
        VITE_TENDERLY_RPC_URI_FOR_1: 'https://public.rpc'
      })
    ).toEqual({
      isTenderlyModeEnabled: true,
      configuredChains: [
        {
          canonicalChainId: 1,
          canonicalChainName: 'Ethereum',
          executionChainId: 694201,
          hasAdminRpc: false
        }
      ]
    })
  })
})

describe('buildTenderlySnapshotRecord', () => {
  it('creates a normalized baseline snapshot record', () => {
    const record = buildTenderlySnapshotRecord({
      canonicalChainId: 1,
      executionChainId: 694201,
      snapshotId: '0x1',
      isBaseline: true
    })

    expect(record.kind).toBe('baseline')
    expect(record.lastKnownStatus).toBe('valid')
    expect(record.label.startsWith('Baseline ')).toBe(true)
  })
})

describe('buildTenderlyRevertResponse', () => {
  it('returns a success payload when Tenderly restores the snapshot', () => {
    expect(buildTenderlyRevertResponse(true, '0x1')).toEqual({
      success: true,
      revertedSnapshotId: '0x1'
    })
  })

  it('throws when Tenderly rejects the revert', () => {
    expect(() => buildTenderlyRevertResponse(false, '0xdead')).toThrow('Tenderly rejected revert for snapshot 0xdead')
  })
})

describe('resolveTenderlyFundRpcRequest', () => {
  it('builds native balance funding calls', () => {
    const request: TTenderlyFundRequest = {
      canonicalChainId: 1,
      walletAddress: '0x1111111111111111111111111111111111111111',
      assetKind: 'native',
      symbol: 'ETH',
      decimals: 18,
      amount: '1.5',
      mode: 'add'
    }

    expect(resolveTenderlyFundRpcRequest(request)).toEqual({
      method: 'tenderly_addBalance',
      params: [['0x1111111111111111111111111111111111111111'], '0x14d1120d7b160000']
    })
  })

  it('builds ERC-20 funding calls', () => {
    const request: TTenderlyFundRequest = {
      canonicalChainId: 1,
      walletAddress: '0x1111111111111111111111111111111111111111',
      assetKind: 'erc20',
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
      amount: '50000'
    }

    expect(resolveTenderlyFundRpcRequest(request)).toEqual({
      method: 'tenderly_setErc20Balance',
      params: [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0x1111111111111111111111111111111111111111',
        '0xba43b7400'
      ]
    })
  })
})
