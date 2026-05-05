import type { DepositEvent, TransferEvent, UserEvents, WithdrawEvent } from '../types'
import type { TransactionActivityEvents } from './graphql'
import { lowerCaseAddress, toVaultKey } from './pnlShared'
import type { TRawPnlEvent, TRawScopes } from './pnlTypes'
import { getFamilyVaultAddress, isStakingVault } from './staking'

function compareRawEvents(a: TRawPnlEvent, b: TRawPnlEvent): number {
  return (
    a.blockTimestamp - b.blockTimestamp ||
    a.blockNumber - b.blockNumber ||
    a.logIndex - b.logIndex ||
    a.id.localeCompare(b.id)
  )
}

function normalizeDeposit(event: DepositEvent): Omit<Extract<TRawPnlEvent, { kind: 'deposit' }>, 'scopes'> {
  return {
    kind: 'deposit',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    transactionFrom: lowerCaseAddress(event.transactionFrom),
    owner: lowerCaseAddress(event.owner),
    sender: lowerCaseAddress(event.sender),
    shares: BigInt(event.shares),
    assets: BigInt(event.assets)
  }
}

function normalizeWithdrawal(event: WithdrawEvent): Omit<Extract<TRawPnlEvent, { kind: 'withdrawal' }>, 'scopes'> {
  return {
    kind: 'withdrawal',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    transactionFrom: lowerCaseAddress(event.transactionFrom),
    owner: lowerCaseAddress(event.owner),
    shares: BigInt(event.shares),
    assets: BigInt(event.assets)
  }
}

function normalizeTransfer(event: TransferEvent): Omit<Extract<TRawPnlEvent, { kind: 'transfer' }>, 'scopes'> {
  return {
    kind: 'transfer',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    transactionFrom: lowerCaseAddress(event.transactionFrom),
    sender: lowerCaseAddress(event.sender),
    receiver: lowerCaseAddress(event.receiver),
    shares: BigInt(event.value)
  }
}

function mergeRawEvent(
  merged: Map<string, TRawPnlEvent>,
  event: Omit<TRawPnlEvent, 'scopes'>,
  scope: keyof TRawScopes
): void {
  const eventKey = `${event.kind}:${event.id}`
  const existing = merged.get(eventKey)

  if (existing) {
    existing.scopes[scope] = true
    return
  }

  merged.set(eventKey, {
    ...event,
    scopes: {
      address: scope === 'address',
      tx: scope === 'tx'
    }
  })
}

export function buildAddressScopedRawPnlEvents(addressEvents: UserEvents): TRawPnlEvent[] {
  const merged = new Map<string, TRawPnlEvent>()
  const eventSources: Array<{ events: Array<Omit<TRawPnlEvent, 'scopes'>>; scope: keyof TRawScopes }> = [
    { events: addressEvents.deposits.map(normalizeDeposit), scope: 'address' },
    { events: addressEvents.withdrawals.map(normalizeWithdrawal), scope: 'address' },
    { events: addressEvents.transfersIn.map(normalizeTransfer), scope: 'address' },
    { events: addressEvents.transfersOut.map(normalizeTransfer), scope: 'address' }
  ]

  eventSources.forEach(({ events, scope }) => {
    events.forEach((event) => {
      mergeRawEvent(merged, event, scope)
    })
  })

  return Array.from(merged.values()).sort(compareRawEvents)
}

export function mergeAddressScopedRawPnlEventsWithTransactionActivity(
  addressEvents: TRawPnlEvent[],
  transactionEvents: TransactionActivityEvents,
  allowedFamilyKeys?: Set<string>
): TRawPnlEvent[] {
  const merged = new Map<string, TRawPnlEvent>()

  addressEvents.forEach((event) => {
    merged.set(`${event.kind}:${event.id}`, {
      ...event,
      scopes: { ...event.scopes }
    })
  })

  const txEventSources: Array<Omit<TRawPnlEvent, 'scopes'>> = [
    ...transactionEvents.deposits.map(normalizeDeposit),
    ...transactionEvents.withdrawals.map(normalizeWithdrawal),
    ...transactionEvents.transfers.map(normalizeTransfer)
  ]

  txEventSources
    .filter((event) =>
      allowedFamilyKeys ? allowedFamilyKeys.has(toVaultKey(event.chainId, event.familyVaultAddress)) : true
    )
    .forEach((event) => {
      mergeRawEvent(merged, event, 'tx')
    })

  return Array.from(merged.values()).sort(compareRawEvents)
}
