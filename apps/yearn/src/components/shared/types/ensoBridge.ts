import type { Hash } from 'viem'

export const ENSO_BRIDGE_PROTOCOLS = ['stargate', 'ccip', 'relay'] as const
export type TEnsoBridgeProtocol = string
export const ENSO_BRIDGE_STATUSES = [
  'pending',
  'inflight',
  'delivered',
  'failed',
  'ready_for_manual_execution',
  'unknown'
] as const
export type TEnsoBridgeStatus = (typeof ENSO_BRIDGE_STATUSES)[number]

export type TEnsoBridgeStatusResponse = {
  status: TEnsoBridgeStatus
  bridgeRequestId?: Hash
  sourceChainId?: number
  sourceTxHash?: Hash
  destinationChainId?: number
  destinationTxHash?: Hash
  error?: string
}

export function isEnsoBridgeProtocol(value: unknown): value is TEnsoBridgeProtocol {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value)
}

export function isEnsoBridgeStatus(value: unknown): value is TEnsoBridgeStatus {
  return typeof value === 'string' && ENSO_BRIDGE_STATUSES.some((status) => status === value)
}
