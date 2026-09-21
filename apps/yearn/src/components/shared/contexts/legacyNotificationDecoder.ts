import { ENSO_BRIDGE_STATUSES } from '@shared/types/ensoBridge'
import type { TNotification } from '@shared/types/notifications'
import { z } from 'zod'

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/)
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/)
const chainId = z.number().int().positive().safe()
const timestamp = z.number().finite().nonnegative()

// Legacy rows are unversioned. Decode them as version 0 without rewriting the
// database or promoting reported status to canonical receipt/settlement evidence.
const legacyNotification = z
  .object({
    version: z.literal(0).optional(),
    lifecycleRecord: z.never().optional(),
    id: z.number().int().nonnegative().safe().optional(),
    type: z.enum([
      'approve',
      'deposit',
      'withdraw',
      'start cooldown',
      'cancel cooldown',
      'zap',
      'crosschain zap',
      'withdraw zap',
      'crosschain withdraw zap',
      'deposit and stake',
      'stake',
      'unstake',
      'unstake and withdraw',
      'claim',
      'claim and exit',
      'migrate'
    ]),
    address,
    chainId,
    executionChainId: chainId.optional(),
    toChainId: chainId.optional(),
    amount: z.string(),
    status: z.enum(['pending', 'submitted', 'success', 'error']),
    spenderAddress: address.optional(),
    spenderName: z.string().optional(),
    fromAddress: address.optional(),
    fromTokenName: z.string().optional(),
    fromAmount: z.string().optional(),
    toAddress: address.optional(),
    toTokenName: z.string().optional(),
    toAmount: z.string().optional(),
    txHash: hash.optional(),
    destinationTxHash: hash.optional(),
    bridgeRequestId: hash.optional(),
    createdAt: timestamp.optional(),
    sourceConfirmedAt: timestamp.optional(),
    lastBridgeCheckAt: timestamp.optional(),
    bridgeCheckFailureStartedAt: timestamp.optional(),
    timeFinished: timestamp.optional(),
    blockNumber: z.bigint().nonnegative().optional(),
    awaitingExecution: z.boolean().optional(),
    bridgeProtocol: z.string().optional(),
    bridgeStatus: z.enum(ENSO_BRIDGE_STATUSES).optional(),
    bridgeTrackingState: z.enum(['active', 'unavailable']).optional(),
    bridgeError: z.string().optional()
  })
  .passthrough()

export function decodeLegacyNotifications(value: unknown): TNotification[] {
  const result = z.array(legacyNotification).safeParse(value)
  if (!result.success) {
    // Never include persisted contents (wallet addresses or other metadata) in the error.
    throw new Error('Legacy transaction history contains unsupported records. Original history has been preserved.')
  }
  return result.data as TNotification[]
}
