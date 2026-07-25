import { describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import type { VaultWidgetActivity, VaultWidgetConfig } from '../types'
import {
  addVaultWidgetActivitySafely,
  filterVaultWidgetActivities,
  getVaultWidgetRelatedAddresses,
  reconcileVaultWidgetActivity,
  resolveVaultWidgetActivityDestinationChainId,
  updateVaultWidgetActivitySafely
} from './activity'
import type { VaultWidgetExecutionService } from './types'

const account = '0x1111111111111111111111111111111111111111'
const vaultAddress = '0x2222222222222222222222222222222222222222'
const positionAddress = '0x3333333333333333333333333333333333333333'
const unrelatedAddress = '0x4444444444444444444444444444444444444444'
const hash = `0x${'55'.repeat(32)}` as const

function activity(overrides: Partial<VaultWidgetActivity> = {}): VaultWidgetActivity {
  return {
    account,
    amount: '1',
    chainId: 1,
    status: 'submitted',
    timestamp: 100,
    tokenIn: positionAddress,
    type: 'withdraw',
    ...overrides
  }
}

describe('vault widget activity helpers', () => {
  it('does not let unavailable persistence prevent transaction execution', async () => {
    const store = {
      add: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      list: vi.fn(),
      remove: vi.fn(),
      update: vi.fn().mockRejectedValue(new Error('storage unavailable'))
    }

    await expect(addVaultWidgetActivitySafely(store, activity())).resolves.toBeUndefined()
    await expect(updateVaultWidgetActivitySafely(store, 1, { status: 'success' })).resolves.toBeUndefined()
    await expect(updateVaultWidgetActivitySafely(store, undefined, { status: 'success' })).resolves.toBeUndefined()
    expect(store.update).toHaveBeenCalledTimes(1)
  })

  it('filters and sorts activity for the current account, chain, and vault addresses', () => {
    const activities = [
      activity({ timestamp: 100 }),
      activity({ timestamp: 200, tokenIn: unrelatedAddress }),
      activity({ account: unrelatedAddress, timestamp: 300 }),
      activity({ chainId: 10, destinationChainId: 1, timestamp: 400 })
    ]

    expect(
      filterVaultWidgetActivities(activities, {
        account,
        chainId: 1,
        relatedAddresses: [vaultAddress, positionAddress]
      }).map(({ timestamp }) => timestamp)
    ).toEqual([400, 100])
  })

  it('collects direct, family, migration, reward, and explicitly related addresses', () => {
    const config = {
      vaultAddress,
      positionToken: { address: positionAddress },
      positionSources: [{ token: { address: positionAddress } }],
      infoPositionSources: [{ token: { address: unrelatedAddress } }],
      migration: { targetVault: account },
      rewards: { stakingAddress: vaultAddress },
      info: { relatedAddresses: [unrelatedAddress] }
    } as unknown as VaultWidgetConfig

    expect(getVaultWidgetRelatedAddresses(config)).toEqual([vaultAddress, positionAddress, unrelatedAddress, account])
  })

  it('records the actual destination chain for deposits and cross-chain routes', () => {
    expect(
      resolveVaultWidgetActivityDestinationChainId({
        configChainId: 1,
        mode: 'deposit',
        quote: {},
        selectedTokenChainId: 10
      })
    ).toBe(1)
    expect(
      resolveVaultWidgetActivityDestinationChainId({
        configChainId: 1,
        mode: 'deposit',
        quote: {
          bridge: {
            destinationChainId: 42161,
            protocol: 'relay',
            sourceChainId: 10
          }
        },
        selectedTokenChainId: 10
      })
    ).toBe(42161)
    expect(
      resolveVaultWidgetActivityDestinationChainId({
        configChainId: 1,
        mode: 'withdraw',
        quote: {},
        selectedTokenChainId: 10
      })
    ).toBe(10)
  })

  it('resumes a final EOA transaction from its persisted hash', async () => {
    const waitForReceipt = vi.fn().mockResolvedValue(undefined)
    const result = await reconcileVaultWidgetActivity({
      activity: activity({ hash, isFinalTransaction: true }),
      config: {} as Config,
      execution: { execute: vi.fn(), waitForReceipt }
    })

    expect(waitForReceipt).toHaveBeenCalledWith(expect.anything(), 1, hash)
    expect(result).toMatchObject({ hash, status: 'success' })
  })

  it('resumes a Safe proposal and cross-chain delivery', async () => {
    const destinationHash = `0x${'66'.repeat(32)}` as const
    const staleHash = `0x${'77'.repeat(32)}` as const
    const waitForSafeExecution = vi.fn().mockResolvedValue(hash)
    const waitForCompletion = vi.fn().mockResolvedValue({
      destinationChainId: 10,
      destinationTxHash: destinationHash,
      sourceChainId: 1,
      sourceTxHash: hash,
      status: 'delivered'
    })
    const result = await reconcileVaultWidgetActivity({
      activity: activity({
        bridge: { destinationChainId: 10, protocol: 'relay', sourceChainId: 1 },
        hash: staleHash,
        isFinalTransaction: true,
        proposalId: '0x1234'
      }),
      config: {} as Config,
      ensoBridge: { waitForCompletion },
      execution: { execute: vi.fn(), waitForReceipt: vi.fn(), waitForSafeExecution }
    })

    expect(waitForSafeExecution).toHaveBeenCalledWith(expect.anything(), 1, '0x1234')
    expect(waitForCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ sourceTxHash: hash, destinationChainId: 10 })
    )
    expect(result).toMatchObject({ destinationHash, hash, status: 'success' })
  })

  it('marks a receiptless Safe completion as an activity error', async () => {
    const execution = {
      execute: vi.fn(),
      waitForReceipt: vi.fn(),
      waitForSafeExecution: vi.fn().mockResolvedValue(undefined)
    } as unknown as VaultWidgetExecutionService
    const result = await reconcileVaultWidgetActivity({
      activity: activity({ isFinalTransaction: true, proposalId: '0x1234' }),
      config: {} as Config,
      execution
    })

    expect(result).toMatchObject({ status: 'error' })
    expect(execution.waitForReceipt).not.toHaveBeenCalled()
  })

  it('does not mistake an intermediate approval receipt for workflow completion', async () => {
    const waitForReceipt = vi.fn()

    await expect(
      reconcileVaultWidgetActivity({
        activity: activity({ hash, isFinalTransaction: false }),
        config: {} as Config,
        execution: { execute: vi.fn(), waitForReceipt }
      })
    ).resolves.toBeUndefined()
    expect(waitForReceipt).not.toHaveBeenCalled()
  })
})
