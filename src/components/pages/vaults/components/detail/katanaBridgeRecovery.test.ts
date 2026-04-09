import type { KatanaBridgeAssetConfig } from '@pages/vaults/components/widget/katanaBridge'
import type { TKatanaBridgeTransaction } from '@shared/utils/katanaBridge'
import { describe, expect, it } from 'vitest'
import { getKatanaBridgeTransactionDirection, pickKatanaBridgeRecoveryTransaction } from './katanaBridgeRecovery'

const assetConfig: KatanaBridgeAssetConfig = {
  sourceChainId: 1,
  sourceTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  sourceTokenSymbol: 'USDC',
  destinationChainId: 1,
  destinationTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  destinationTokenSymbol: 'USDC',
  bridgeContractAddress: '0x53E82ABbb12638F09d9e624578ccB666217a765e',
  ethereumVaultBridgeAddress: '0x53E82ABbb12638F09d9e624578ccB666217a765e',
  katanaUnifiedBridgeAddress: '0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe',
  katanaAssetAddress: '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36',
  katanaAssetSymbol: 'USDC'
}

function buildTransaction(partial: Partial<TKatanaBridgeTransaction>): TKatanaBridgeTransaction {
  return {
    sourceTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    status: 'BRIDGE_PENDING',
    ...partial
  }
}

describe('katanaBridgeRecovery', () => {
  it('resolves transaction direction from Katana and Ethereum network ids', () => {
    expect(getKatanaBridgeTransactionDirection(buildTransaction({ fromChainId: 20, toChainId: 0 }))).toBe('to-ethereum')
    expect(getKatanaBridgeTransactionDirection(buildTransaction({ fromChainId: 0, toChainId: 20 }))).toBe('to-katana')
  })

  it('prefers ready-to-claim transactions for the current vault asset', () => {
    const transactions = [
      buildTransaction({
        sourceTxHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        fromChainId: 20,
        toChainId: 0,
        tokenSymbol: 'USDC',
        status: 'BRIDGE_PENDING',
        timestamp: 10
      }),
      buildTransaction({
        sourceTxHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        fromChainId: 20,
        toChainId: 0,
        tokenAddress: assetConfig.katanaAssetAddress,
        status: 'READY_TO_CLAIM',
        timestamp: 5
      })
    ]

    expect(
      pickKatanaBridgeRecoveryTransaction({
        transactions,
        assetConfig
      })?.sourceTxHash
    ).toBe('0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')
  })

  it('falls back to transactions without token metadata so recovery still works after reload', () => {
    const transaction = buildTransaction({
      fromChainId: 20,
      toChainId: 0,
      status: 'READY_TO_CLAIM',
      timestamp: 20
    })

    expect(
      pickKatanaBridgeRecoveryTransaction({
        transactions: [transaction],
        assetConfig
      })
    ).toEqual(transaction)
  })
})
