import { describe, expect, it } from 'vitest'
import {
  hasKatanaBridgeBalanceDeltaArrived,
  normalizeKatanaBridgeLifecycleStatus,
  normalizeKatanaBridgeTransactionsResponse
} from './katanaBridge'

describe('katanaBridge', () => {
  it('maps hosted API statuses into widget bridge lifecycle states', () => {
    expect(normalizeKatanaBridgeLifecycleStatus('READY_TO_CLAIM')).toBe('READY_TO_CLAIM')
    expect(normalizeKatanaBridgeLifecycleStatus('CLAIMED')).toBe('COMPLETED')
    expect(normalizeKatanaBridgeLifecycleStatus('FAILED')).toBe('FAILED')
    expect(normalizeKatanaBridgeLifecycleStatus('BRIDGE_PENDING')).toBe('BRIDGE_PENDING')
  })

  it('normalizes transaction payloads from the hosted transactions API', () => {
    const response = normalizeKatanaBridgeTransactionsResponse({
      data: [
        {
          transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          claimTransactionHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          status: 'READY_TO_CLAIM',
          sourceChain: { id: 1 },
          destChain: { id: 747474 },
          tokenForTxn: { amount: '1000000' },
          depositCount: '7',
          timestamp: 1_716_000_000_000
        }
      ]
    })

    expect(response.transactions).toEqual([
      {
        sourceTxHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        claimTxHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        status: 'READY_TO_CLAIM',
        rawStatus: 'READY_TO_CLAIM',
        receiver: undefined,
        fromChainId: 1,
        toChainId: 747474,
        amount: '1000000',
        depositCount: '7',
        timestamp: 1_716_000_000
      }
    ])
  })

  it('requires a positive balance delta before marking a bridge complete from wallet balance', () => {
    expect(
      hasKatanaBridgeBalanceDeltaArrived({
        baselineBalance: 1_000_000n,
        currentBalance: 1_000_000n,
        requiredAmount: 1_000_000n
      })
    ).toBe(false)

    expect(
      hasKatanaBridgeBalanceDeltaArrived({
        baselineBalance: 1_000_000n,
        currentBalance: 1_500_000n,
        requiredAmount: 1_000_000n
      })
    ).toBe(false)

    expect(
      hasKatanaBridgeBalanceDeltaArrived({
        baselineBalance: 1_000_000n,
        currentBalance: 2_000_000n,
        requiredAmount: 1_000_000n
      })
    ).toBe(true)
  })
})
