import { createHash } from 'node:crypto'
import { buildPositionTimeline } from '@/server/lib/holdings/services/holdings'
import { buildAddressScopedRawPnlEvents } from '@/server/lib/holdings/services/pnlEvents'
import {
  getSettledAddressScopedContext,
  getVaultIdentifiers,
  type TSettledAddressScopedContext
} from '@/server/lib/holdings/services/settledHoldingsContext'
import type { UserEvents } from '@/server/lib/holdings/types'

const CONTEXT_CONCURRENCY = 3

export function getBundleGrowthIdentity(addresses: readonly string[]): string {
  return `bundle-growth:v1:${createHash('sha256').update(addresses.join(',')).digest('hex')}`
}

function mergeEvents<K extends keyof UserEvents>(contexts: TSettledAddressScopedContext[], kind: K): UserEvents[K] {
  const unique = new Map<string, UserEvents[K][number]>()
  contexts.forEach(({ events }) => {
    events[kind].forEach((event) => {
      unique.set(`${event.chainId}:${event.id}`, event)
    })
  })
  return [...unique.values()] as UserEvents[K]
}

export async function loadBundleGrowthContext(
  addresses: string[],
  identity: string
): Promise<TSettledAddressScopedContext> {
  const contexts = await Array.from({ length: Math.ceil(addresses.length / CONTEXT_CONCURRENCY) }).reduce<
    Promise<TSettledAddressScopedContext[]>
  >(async (previous, _, index) => {
    const collected = await previous
    const start = index * CONTEXT_CONCURRENCY
    const next = await Promise.all(
      addresses
        .slice(start, start + CONTEXT_CONCURRENCY)
        .map((userAddress) => getSettledAddressScopedContext({ userAddress }))
    )
    collected.push(...next)
    return collected
  }, Promise.resolve([]))
  const events = {
    deposits: mergeEvents(contexts, 'deposits'),
    withdrawals: mergeEvents(contexts, 'withdrawals'),
    transfersIn: mergeEvents(contexts, 'transfersIn'),
    transfersOut: mergeEvents(contexts, 'transfersOut')
  }
  const rawEvents = buildAddressScopedRawPnlEvents(events)
  const first = contexts[0]
  if (!first || contexts.some((context) => context.maxTimestamp !== first.maxTimestamp)) {
    throw new Error('Bundle members must use the same settled day.')
  }
  return {
    address: identity,
    maxTimestamp: first.maxTimestamp,
    latestSettledDayTimestamp: first.latestSettledDayTimestamp,
    events,
    timeline: buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut),
    rawEvents,
    rawVaultIdentifiers: getVaultIdentifiers(rawEvents),
    hasActivity: rawEvents.length > 0,
    vaultMetadata: new Map(contexts.flatMap((context) => [...context.vaultMetadata])),
    metadataFetchFailedVaults: contexts.reduce((total, context) => total + context.metadataFetchFailedVaults, 0)
  }
}
