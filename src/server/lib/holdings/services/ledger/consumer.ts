import { holdingsConfig } from '@/server/lib/holdings/config'
import type { THoldingsEventSource, THoldingsEventSourceRequest } from '@/server/lib/holdings/services/eventSource'
import { processLedgerSourceEvents } from '@/server/lib/holdings/services/graphql'
import {
  getVerifiedLedgerRevisionValues,
  type TLedgerVerifiedRevisionV1
} from '@/server/lib/holdings/services/ledger/codec'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import { LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'
import type { TLedgerBaseSourceEvent, TLedgerSixStreams } from '@/server/lib/holdings/services/ledger/types'

const SNAPSHOT_ID_PATTERN = /^snapshot_[a-f0-9]{32}$/

export interface TCreateLedgerEventSourceArgs {
  readonly snapshotId: string
  readonly latestSettledDayTimestamp: number
  readonly eventUpperTimestamp: number
  readonly verified: TLedgerVerifiedRevisionV1
}

function assertSnapshotTimestamp(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative Unix timestamp`)
  }
}

function assertCompatibleRevision(args: TCreateLedgerEventSourceArgs): void {
  if (!SNAPSHOT_ID_PATTERN.test(args.snapshotId)) {
    throw new Error('Ledger snapshot id is invalid')
  }
  assertSnapshotTimestamp(args.latestSettledDayTimestamp, 'Ledger latest settled day')
  assertSnapshotTimestamp(args.eventUpperTimestamp, 'Ledger event upper bound')
  if (args.eventUpperTimestamp < args.latestSettledDayTimestamp) {
    throw new Error('Ledger event upper bound cannot precede the latest settled day')
  }

  const { head, manifest } = getVerifiedLedgerRevisionValues(args.verified)
  if (
    head.calculationVersion !== LEDGER_CALCULATION_VERSION ||
    manifest.calculationVersion !== LEDGER_CALCULATION_VERSION
  ) {
    throw new Error('Ledger calculation version is incompatible')
  }
  const requiredChainIds = holdingsConfig.ledgerChainIds
  if (requiredChainIds.some((chainId) => !manifest.chainScope.includes(chainId))) {
    throw new Error('Ledger revision does not cover every configured holdings chain')
  }
}

function copyEventsThroughTimestamp<TEvent extends TLedgerBaseSourceEvent>(
  events: readonly TEvent[],
  allowedChainIds: ReadonlySet<number>,
  maxTimestamp: number
): TEvent[] {
  return events
    .filter((event) => allowedChainIds.has(event.chainId) && event.blockTimestamp <= maxTimestamp)
    .map((event) => ({ ...event }) as TEvent)
}

export function filterLedgerSourceEventsForSnapshot(
  streams: TLedgerSixStreams,
  maxTimestamp: number
): TLedgerSixStreams {
  assertSnapshotTimestamp(maxTimestamp, 'Ledger event cutoff')
  const allowedChainIds = new Set(holdingsConfig.ledgerChainIds)
  return {
    v3Deposits: copyEventsThroughTimestamp(streams.v3Deposits, allowedChainIds, maxTimestamp),
    v3Withdrawals: copyEventsThroughTimestamp(streams.v3Withdrawals, allowedChainIds, maxTimestamp),
    v2Deposits: copyEventsThroughTimestamp(streams.v2Deposits, allowedChainIds, maxTimestamp),
    v2Withdrawals: copyEventsThroughTimestamp(streams.v2Withdrawals, allowedChainIds, maxTimestamp),
    transfersIn: copyEventsThroughTimestamp(streams.transfersIn, allowedChainIds, maxTimestamp),
    transfersOut: copyEventsThroughTimestamp(streams.transfersOut, allowedChainIds, maxTimestamp)
  }
}

export function createLedgerEventSource(args: TCreateLedgerEventSourceArgs): THoldingsEventSource {
  assertCompatibleRevision(args)
  const { head, manifest } = getVerifiedLedgerRevisionValues(args.verified)
  const key = JSON.stringify([
    'ledger',
    args.snapshotId,
    manifest.calculationVersion,
    manifest.sourceGeneration,
    manifest.revision,
    head.manifestChecksum
  ])

  return Object.freeze({
    key,
    latestSettledDayTimestamp: args.latestSettledDayTimestamp,
    eventUpperTimestamp: args.eventUpperTimestamp,
    load: async (request: THoldingsEventSourceRequest) => {
      if (hashLedgerWalletAddress(request.userAddress) !== head.walletHash) {
        throw new Error('Ledger snapshot wallet does not match the requested wallet')
      }
      const requestedUpperTimestamp = request.maxTimestamp ?? args.eventUpperTimestamp
      const maxTimestamp = Math.min(requestedUpperTimestamp, args.eventUpperTimestamp)
      const filteredStreams = filterLedgerSourceEventsForSnapshot(args.verified.streams, maxTimestamp)
      return processLedgerSourceEvents(filteredStreams, request.version)
    }
  })
}
