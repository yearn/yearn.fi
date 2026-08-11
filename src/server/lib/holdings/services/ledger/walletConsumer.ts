import type { THoldingsEventSource, THoldingsEventSourceRequest } from '@/server/lib/holdings/services/eventSource'
import { processLedgerSourceEvents } from '@/server/lib/holdings/services/graphql'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import { LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'
import type { TLedgerBaseSourceEvent, TLedgerSixStreams } from '@/server/lib/holdings/services/ledger/types'
import type { TWalletLedgerState } from '@/server/lib/holdings/services/ledger/walletTypes'

export interface TCreateWalletLedgerEventSourceArguments {
  readonly ledger: TWalletLedgerState
  readonly latestSettledDayTimestamp: number
  readonly eventUpperTimestamp: number
}

function assertTimestamp(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative Unix timestamp`)
  }
}

function copyEvents<TEvent extends TLedgerBaseSourceEvent>(
  events: readonly TEvent[],
  allowedChainIds: ReadonlySet<number>,
  maxTimestamp: number
): TEvent[] {
  return events
    .filter((event) => allowedChainIds.has(event.chainId) && event.blockTimestamp <= maxTimestamp)
    .map((event) => ({ ...event }) as TEvent)
}

export function filterWalletLedgerStreams(ledger: TWalletLedgerState, maxTimestamp: number): TLedgerSixStreams {
  assertTimestamp(maxTimestamp, 'Wallet ledger event cutoff')
  const allowedChainIds = new Set(ledger.coverage.map(({ chainId }) => chainId))
  return {
    v3Deposits: copyEvents(ledger.streams.v3Deposits, allowedChainIds, maxTimestamp),
    v3Withdrawals: copyEvents(ledger.streams.v3Withdrawals, allowedChainIds, maxTimestamp),
    v2Deposits: copyEvents(ledger.streams.v2Deposits, allowedChainIds, maxTimestamp),
    v2Withdrawals: copyEvents(ledger.streams.v2Withdrawals, allowedChainIds, maxTimestamp),
    transfersIn: copyEvents(ledger.streams.transfersIn, allowedChainIds, maxTimestamp),
    transfersOut: copyEvents(ledger.streams.transfersOut, allowedChainIds, maxTimestamp)
  }
}

export function createWalletLedgerEventSource(args: TCreateWalletLedgerEventSourceArguments): THoldingsEventSource {
  assertTimestamp(args.latestSettledDayTimestamp, 'Wallet ledger latest settled day')
  assertTimestamp(args.eventUpperTimestamp, 'Wallet ledger event upper bound')
  if (args.latestSettledDayTimestamp > args.eventUpperTimestamp) {
    throw new Error('Wallet ledger latest settled day cannot follow the event upper bound')
  }
  if (args.ledger.calculationVersion !== LEDGER_CALCULATION_VERSION) {
    throw new Error('Wallet ledger calculation version is incompatible')
  }
  const key = JSON.stringify([
    'wallet-ledger',
    args.ledger.calculationVersion,
    args.ledger.sourceGeneration,
    args.ledger.revision
  ])

  return Object.freeze({
    key,
    latestSettledDayTimestamp: args.latestSettledDayTimestamp,
    eventUpperTimestamp: args.eventUpperTimestamp,
    load: async (request: THoldingsEventSourceRequest) => {
      if (hashLedgerWalletAddress(request.userAddress) !== args.ledger.walletHash) {
        throw new Error('Wallet ledger does not match the requested wallet')
      }
      const requestedUpperTimestamp = request.maxTimestamp ?? args.eventUpperTimestamp
      const maxTimestamp = Math.min(requestedUpperTimestamp, args.eventUpperTimestamp)
      return processLedgerSourceEvents(filterWalletLedgerStreams(args.ledger, maxTimestamp), request.version)
    }
  })
}
