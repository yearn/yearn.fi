import { getAddress } from 'viem'
import { config } from '../config'
import type { DepositEvent, TransferEvent, UserEvents, V2DepositEvent, V2WithdrawEvent, WithdrawEvent } from '../types'
import { debugError, debugLog } from './debug'

// V3 Vault Queries (with optional maxTimestamp filter)
const DEPOSITS_QUERY = `
  query GetDeposits($owner: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Deposit(where: { owner: { _eq: $owner }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      owner
      sender
      assets
      shares
    }
  }
`

const WITHDRAWALS_QUERY = `
  query GetWithdrawals($owner: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Withdraw(where: { owner: { _eq: $owner }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      owner
      assets
      shares
    }
  }
`

const TRANSFERS_IN_QUERY = `
  query GetTransfersIn($receiver: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Transfer(where: { receiver: { _eq: $receiver }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      sender
      receiver
      value
    }
  }
`

const TRANSFERS_OUT_QUERY = `
  query GetTransfersOut($sender: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Transfer(where: { sender: { _eq: $sender }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      sender
      receiver
      value
    }
  }
`

const BATCH_SIZE = 1000
const SINGLE_QUERY_LIMIT = 50000

// V2 Vault Queries (with optional maxTimestamp filter)
const V2_DEPOSITS_QUERY = `
  query GetV2Deposits($recipient: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Deposit(where: { recipient: { _eq: $recipient }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      recipient
      amount
      shares
    }
  }
`

const V2_WITHDRAWALS_QUERY = `
  query GetV2Withdrawals($recipient: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Withdraw(where: { recipient: { _eq: $recipient }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      recipient
      amount
      shares
    }
  }
`

const DEPOSITS_BY_TX_FROM_QUERY = `
  query GetDepositsByTransactionFrom($transactionFrom: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Deposit(where: { transactionFrom: { _eq: $transactionFrom }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      owner
      sender
      assets
      shares
    }
  }
`

const WITHDRAWALS_BY_TX_FROM_QUERY = `
  query GetWithdrawalsByTransactionFrom($transactionFrom: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Withdraw(where: { transactionFrom: { _eq: $transactionFrom }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      owner
      assets
      shares
    }
  }
`

const V2_DEPOSITS_BY_TX_FROM_QUERY = `
  query GetV2DepositsByTransactionFrom($transactionFrom: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Deposit(where: { transactionFrom: { _eq: $transactionFrom }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      recipient
      amount
      shares
    }
  }
`

const V2_WITHDRAWALS_BY_TX_FROM_QUERY = `
  query GetV2WithdrawalsByTransactionFrom($transactionFrom: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Withdraw(where: { transactionFrom: { _eq: $transactionFrom }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      recipient
      amount
      shares
    }
  }
`

const TRANSFERS_BY_TX_FROM_QUERY = `
  query GetTransfersByTransactionFrom($transactionFrom: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Transfer(where: { transactionFrom: { _eq: $transactionFrom }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      sender
      receiver
      value
    }
  }
`

const DEPOSITS_BY_TX_HASHES_QUERY = `
  query GetDepositsByTransactionHashes($chainId: Int!, $transactionHashes: [String!]!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Deposit(where: { chainId: { _eq: $chainId }, transactionHash: { _in: $transactionHashes }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      owner
      sender
      assets
      shares
    }
  }
`

const WITHDRAWALS_BY_TX_HASHES_QUERY = `
  query GetWithdrawalsByTransactionHashes($chainId: Int!, $transactionHashes: [String!]!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Withdraw(where: { chainId: { _eq: $chainId }, transactionHash: { _in: $transactionHashes }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      owner
      assets
      shares
    }
  }
`

const V2_DEPOSITS_BY_TX_HASHES_QUERY = `
  query GetV2DepositsByTransactionHashes($chainId: Int!, $transactionHashes: [String!]!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Deposit(where: { chainId: { _eq: $chainId }, transactionHash: { _in: $transactionHashes }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      recipient
      amount
      shares
    }
  }
`

const V2_WITHDRAWALS_BY_TX_HASHES_QUERY = `
  query GetV2WithdrawalsByTransactionHashes($chainId: Int!, $transactionHashes: [String!]!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Withdraw(where: { chainId: { _eq: $chainId }, transactionHash: { _in: $transactionHashes }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      recipient
      amount
      shares
    }
  }
`

const TRANSFERS_BY_TX_HASHES_QUERY = `
  query GetTransfersByTransactionHashes($chainId: Int!, $transactionHashes: [String!]!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Transfer(where: { chainId: { _eq: $chainId }, transactionHash: { _in: $transactionHashes }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: asc }, { blockNumber: asc }, { logIndex: asc }], limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      logIndex
      transactionHash
      transactionFrom
      sender
      receiver
      value
    }
  }
`

const USER_EVENT_COUNTS_AGGREGATE_QUERY = `
  query GetUserEventCountsAggregate($address: String!, $maxTimestamp: Int!) {
    deposits: Deposit_aggregate(where: { owner: { _eq: $address }, blockTimestamp: { _lte: $maxTimestamp } }) {
      aggregate {
        count
      }
    }
    withdrawals: Withdraw_aggregate(where: { owner: { _eq: $address }, blockTimestamp: { _lte: $maxTimestamp } }) {
      aggregate {
        count
      }
    }
    transfersIn: Transfer_aggregate(where: { receiver: { _eq: $address }, blockTimestamp: { _lte: $maxTimestamp } }) {
      aggregate {
        count
      }
    }
    transfersOut: Transfer_aggregate(where: { sender: { _eq: $address }, blockTimestamp: { _lte: $maxTimestamp } }) {
      aggregate {
        count
      }
    }
    v2Deposits: V2Deposit_aggregate(where: { recipient: { _eq: $address }, blockTimestamp: { _lte: $maxTimestamp } }) {
      aggregate {
        count
      }
    }
    v2Withdrawals: V2Withdraw_aggregate(where: { recipient: { _eq: $address }, blockTimestamp: { _lte: $maxTimestamp } }) {
      aggregate {
        count
      }
    }
  }
`

interface UserCounts {
  depositCount: number
  withdrawCount: number
  transferInCount: number
  transferOutCount: number
  v2DepositCount: number
  v2WithdrawCount: number
}

interface AggregateCountField {
  aggregate: {
    count: number
  } | null
}

interface UserCountsAggregateQuery {
  deposits: AggregateCountField | null
  withdrawals: AggregateCountField | null
  transfersIn: AggregateCountField | null
  transfersOut: AggregateCountField | null
  v2Deposits: AggregateCountField | null
  v2Withdrawals: AggregateCountField | null
}

async function executeQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // Only add admin secret if explicitly configured (not the default 'testing' value)
  const password = config.envioPassword
  if (password && password !== 'testing') {
    headers['x-hasura-admin-secret'] = password
  }

  const response = await fetch(config.envioGraphqlUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`)
  }

  const json = (await response.json()) as { data: T; errors?: unknown[] }

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
  }

  return json.data
}

function getAggregateCount(field: AggregateCountField | null | undefined): number {
  return field?.aggregate?.count ?? 0
}

function getGraphqlAddress(address: string): string {
  return getAddress(address)
}

async function fetchUserCounts(userAddress: string, maxTimestamp?: number): Promise<UserCounts | null> {
  const address = getGraphqlAddress(userAddress)
  const addressLower = address.toLowerCase()
  const ts = maxTimestamp ?? DEFAULT_MAX_TIMESTAMP

  try {
    const data = await executeQuery<UserCountsAggregateQuery>(USER_EVENT_COUNTS_AGGREGATE_QUERY, {
      address,
      maxTimestamp: ts
    })

    debugLog('graphql', 'loaded aggregate user event counts', {
      address: addressLower,
      maxTimestamp: ts
    })
    return {
      depositCount: getAggregateCount(data.deposits),
      withdrawCount: getAggregateCount(data.withdrawals),
      transferInCount: getAggregateCount(data.transfersIn),
      transferOutCount: getAggregateCount(data.transfersOut),
      v2DepositCount: getAggregateCount(data.v2Deposits),
      v2WithdrawCount: getAggregateCount(data.v2Withdrawals)
    }
  } catch (error) {
    debugError(
      'graphql',
      'aggregate user event counts fetch failed, falling back to sequential event pagination',
      error,
      {
        address: addressLower,
        maxTimestamp: ts
      }
    )
    return null
  }
}

// Default maxTimestamp: 10 years from now (queries require a value, can't be null)
// Using a smaller value to avoid integer overflow in GraphQL
const DEFAULT_MAX_TIMESTAMP = 2000000000 // ~year 2033, safe 32-bit integer
const TX_HASH_BATCH_SIZE = 200
const TX_HASH_QUERY_CONCURRENCY = 5

// Sequential pagination - fetch pages until we get fewer results than BATCH_SIZE
async function fetchAllSequential<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  maxTimestamp?: number
): Promise<T[]> {
  const allResults: T[] = []
  let offset = 0
  const ts = maxTimestamp ?? DEFAULT_MAX_TIMESTAMP
  let pages = 0

  while (true) {
    const variables: Record<string, unknown> = { [variableKey]: address, limit: BATCH_SIZE, offset, maxTimestamp: ts }
    let data: Record<string, T[]>
    const pageNumber = pages + 1
    const startedAt = Date.now()

    try {
      data = await executeQuery<Record<string, T[]>>(query, variables)
    } catch (error) {
      debugError('graphql', 'sequential event fetch failed', error, {
        resultKey,
        variableKey,
        address,
        offset,
        maxTimestamp: ts
      })
      throw error
    }
    const batch = data[resultKey] || []
    pages += 1
    const durationMs = Date.now() - startedAt

    debugLog('graphql', 'fetched sequential event page', {
      resultKey,
      variableKey,
      address,
      page: pageNumber,
      offset,
      limit: BATCH_SIZE,
      batchCount: batch.length,
      durationMs,
      maxTimestamp: ts
    })

    allResults.push(...batch)

    if (batch.length < BATCH_SIZE) {
      break
    }

    offset += BATCH_SIZE
  }

  debugLog('graphql', 'fetched sequential event set', {
    resultKey,
    variableKey,
    address,
    count: allResults.length,
    pages,
    maxTimestamp: ts
  })
  return allResults
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

function dedupeById<T extends { id: string }>(events: T[]): T[] {
  return Array.from(
    events
      .reduce<Map<string, T>>((deduped, event) => {
        if (!deduped.has(event.id)) {
          deduped.set(event.id, event)
        }

        return deduped
      }, new Map<string, T>())
      .values()
  )
}

function collectAddressTransactionHashes(events: UserEvents): Map<number, string[]> {
  const groupedHashes = new Map<number, Set<string>>()
  const allAddressEvents = [...events.deposits, ...events.withdrawals, ...events.transfersIn, ...events.transfersOut]

  allAddressEvents.forEach((event) => {
    if (!event.transactionHash) {
      return
    }

    const txHashes = groupedHashes.get(event.chainId) ?? new Set<string>()
    txHashes.add(event.transactionHash.toLowerCase())
    groupedHashes.set(event.chainId, txHashes)
  })

  return Array.from(groupedHashes.entries()).reduce<Map<number, string[]>>((grouped, [chainId, hashes]) => {
    grouped.set(chainId, Array.from(hashes.values()))
    return grouped
  }, new Map<number, string[]>())
}

async function fetchTransactionHashBatch<T>(
  query: string,
  chainId: number,
  transactionHashes: string[],
  resultKey: string,
  maxTimestamp?: number
): Promise<T[]> {
  const allResults: T[] = []
  let offset = 0
  const ts = maxTimestamp ?? DEFAULT_MAX_TIMESTAMP

  while (true) {
    const variables = {
      chainId,
      transactionHashes,
      limit: BATCH_SIZE,
      offset,
      maxTimestamp: ts
    }
    let data: Record<string, T[]>

    try {
      data = await executeQuery<Record<string, T[]>>(query, variables)
    } catch (error) {
      debugError('graphql', 'transaction hash event fetch failed', error, {
        resultKey,
        chainId,
        transactionHashCount: transactionHashes.length,
        offset,
        maxTimestamp: ts
      })
      throw error
    }

    const batch = data[resultKey] || []
    allResults.push(...batch)

    if (batch.length < BATCH_SIZE) {
      break
    }

    offset += BATCH_SIZE
  }

  return allResults
}

async function fetchAllByTransactionHashes<T>(
  query: string,
  transactionHashesByChain: Map<number, string[]>,
  resultKey: string,
  maxTimestamp?: number
): Promise<T[]> {
  const batchSpecs = Array.from(transactionHashesByChain.entries()).flatMap(([chainId, transactionHashes]) =>
    chunkArray(transactionHashes, TX_HASH_BATCH_SIZE).map((txHashBatch) => ({
      chainId,
      transactionHashes: txHashBatch
    }))
  )

  if (batchSpecs.length === 0) {
    debugLog('graphql', 'skipping transaction hash event fetch because there are no address tx hashes', {
      resultKey
    })
    return []
  }

  const allResults: T[] = []

  for (let index = 0; index < batchSpecs.length; index += TX_HASH_QUERY_CONCURRENCY) {
    const batchGroup = batchSpecs.slice(index, index + TX_HASH_QUERY_CONCURRENCY)
    const groupResults = await Promise.all(
      batchGroup.map(({ chainId, transactionHashes }) =>
        fetchTransactionHashBatch<T>(query, chainId, transactionHashes, resultKey, maxTimestamp)
      )
    )

    groupResults.forEach((results) => {
      allResults.push(...results)
    })
  }

  debugLog('graphql', 'fetched transaction hash event set', {
    resultKey,
    chains: transactionHashesByChain.size,
    transactionHashes: Array.from(transactionHashesByChain.values()).reduce(
      (total, hashes) => total + hashes.length,
      0
    ),
    batches: batchSpecs.length,
    count: allResults.length,
    maxTimestamp: maxTimestamp ?? DEFAULT_MAX_TIMESTAMP
  })

  return allResults
}

// Parallel batch fetching using aggregate event counts from GraphQL
async function fetchAllParallel<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  count: number,
  maxTimestamp?: number
): Promise<T[]> {
  if (count === 0) {
    debugLog('graphql', 'skipping parallel event fetch because expected count is zero', {
      resultKey,
      variableKey,
      address
    })
    return []
  }

  const ts = maxTimestamp ?? DEFAULT_MAX_TIMESTAMP
  const batchCount = Math.ceil(count / BATCH_SIZE)
  const offsets = Array.from({ length: batchCount }, (_, i) => i * BATCH_SIZE)

  const batchResults = await Promise.all(
    offsets.map(async (offset, index) => {
      const variables: Record<string, unknown> = { [variableKey]: address, limit: BATCH_SIZE, offset, maxTimestamp: ts }
      const startedAt = Date.now()

      try {
        const data = await executeQuery<Record<string, T[]>>(query, variables)
        const batch = data[resultKey] || []
        const durationMs = Date.now() - startedAt

        debugLog('graphql', 'fetched parallel event page', {
          resultKey,
          variableKey,
          address,
          page: index + 1,
          offset,
          limit: BATCH_SIZE,
          batchCount: batch.length,
          durationMs,
          maxTimestamp: ts
        })

        return batch
      } catch (error) {
        debugError('graphql', 'parallel event fetch failed', error, {
          resultKey,
          variableKey,
          address,
          offset,
          maxTimestamp: ts
        })
        throw error
      }
    })
  )

  const results = batchResults.flat()
  debugLog('graphql', 'fetched parallel event set', {
    resultKey,
    variableKey,
    address,
    count: results.length,
    batches: batchCount,
    maxTimestamp: ts
  })
  return results
}

function normalizeV2Deposit(v2: V2DepositEvent): DepositEvent {
  return {
    id: v2.id,
    vaultAddress: v2.vaultAddress,
    chainId: v2.chainId,
    blockNumber: v2.blockNumber,
    blockTimestamp: v2.blockTimestamp,
    logIndex: v2.logIndex,
    transactionHash: v2.transactionHash,
    transactionFrom: v2.transactionFrom,
    owner: v2.recipient,
    sender: v2.recipient,
    assets: v2.amount,
    shares: v2.shares
  }
}

function normalizeV2Withdraw(v2: V2WithdrawEvent): WithdrawEvent {
  return {
    id: v2.id,
    vaultAddress: v2.vaultAddress,
    chainId: v2.chainId,
    blockNumber: v2.blockNumber,
    blockTimestamp: v2.blockTimestamp,
    logIndex: v2.logIndex,
    transactionHash: v2.transactionHash,
    transactionFrom: v2.transactionFrom,
    owner: v2.recipient,
    assets: v2.amount,
    shares: v2.shares
  }
}

export type VaultVersion = 'v2' | 'v3' | 'all'
export type HoldingsEventFetchType = 'seq' | 'parallel'
export type HoldingsEventPaginationMode = 'paged' | 'all'

type AddressEventFetches = [
  Promise<DepositEvent[]>,
  Promise<WithdrawEvent[]>,
  Promise<V2DepositEvent[]>,
  Promise<V2WithdrawEvent[]>,
  Promise<TransferEvent[]>,
  Promise<TransferEvent[]>
]

type AddressEventResults = [
  DepositEvent[],
  WithdrawEvent[],
  V2DepositEvent[],
  V2WithdrawEvent[],
  TransferEvent[],
  TransferEvent[]
]

type TransactionFromEventResults = [
  DepositEvent[],
  WithdrawEvent[],
  V2DepositEvent[],
  V2WithdrawEvent[],
  TransferEvent[]
]

const inFlightAddressScopedEventFetches = new Map<string, Promise<AddressEventResults>>()

export interface RawPnlEventContext {
  addressEvents: UserEvents
  transactionEvents: {
    deposits: DepositEvent[]
    withdrawals: WithdrawEvent[]
    transfers: TransferEvent[]
  }
}

function sortByBlock<T extends { blockTimestamp: number; blockNumber: number; logIndex: number }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => a.blockTimestamp - b.blockTimestamp || a.blockNumber - b.blockNumber || a.logIndex - b.logIndex
  )
}

function getDepositsByVersion(
  v3Deposits: DepositEvent[],
  v2DepositsRaw: V2DepositEvent[],
  version: VaultVersion
): DepositEvent[] {
  const v2Deposits = v2DepositsRaw.map(normalizeV2Deposit)

  return version === 'v3' ? v3Deposits : version === 'v2' ? v2Deposits : sortByBlock([...v3Deposits, ...v2Deposits])
}

function getWithdrawalsByVersion(
  v3Withdrawals: WithdrawEvent[],
  v2WithdrawalsRaw: V2WithdrawEvent[],
  version: VaultVersion
): WithdrawEvent[] {
  const v2Withdrawals = v2WithdrawalsRaw.map(normalizeV2Withdraw)

  return version === 'v3'
    ? v3Withdrawals
    : version === 'v2'
      ? v2Withdrawals
      : sortByBlock([...v3Withdrawals, ...v2Withdrawals])
}

function getSequentialAddressEventFetches(addressLower: string, maxTimestamp?: number): AddressEventFetches {
  return [
    fetchAllSequential<DepositEvent>(DEPOSITS_QUERY, 'owner', addressLower, 'Deposit', maxTimestamp),
    fetchAllSequential<WithdrawEvent>(WITHDRAWALS_QUERY, 'owner', addressLower, 'Withdraw', maxTimestamp),
    fetchAllSequential<V2DepositEvent>(V2_DEPOSITS_QUERY, 'recipient', addressLower, 'V2Deposit', maxTimestamp),
    fetchAllSequential<V2WithdrawEvent>(V2_WITHDRAWALS_QUERY, 'recipient', addressLower, 'V2Withdraw', maxTimestamp),
    fetchAllSequential<TransferEvent>(TRANSFERS_IN_QUERY, 'receiver', addressLower, 'Transfer', maxTimestamp),
    fetchAllSequential<TransferEvent>(TRANSFERS_OUT_QUERY, 'sender', addressLower, 'Transfer', maxTimestamp)
  ]
}

async function fetchAllSingleQuery<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  maxTimestamp?: number
): Promise<T[]> {
  const ts = maxTimestamp ?? DEFAULT_MAX_TIMESTAMP
  const startedAt = Date.now()
  const variables: Record<string, unknown> = {
    [variableKey]: address,
    limit: SINGLE_QUERY_LIMIT,
    offset: 0,
    maxTimestamp: ts
  }

  try {
    const data = await executeQuery<Record<string, T[]>>(query, variables)
    const results = data[resultKey] || []

    debugLog('graphql', 'fetched single-query event set', {
      resultKey,
      variableKey,
      address,
      count: results.length,
      durationMs: Date.now() - startedAt,
      maxTimestamp: ts,
      limit: SINGLE_QUERY_LIMIT,
      possibleTruncation: results.length === SINGLE_QUERY_LIMIT
    })

    return results
  } catch (error) {
    debugError('graphql', 'single-query event fetch failed', error, {
      resultKey,
      variableKey,
      address,
      maxTimestamp: ts,
      limit: SINGLE_QUERY_LIMIT
    })
    throw error
  }
}

function getParallelAddressEventFetches(
  addressLower: string,
  counts: UserCounts,
  maxTimestamp?: number
): AddressEventFetches {
  return [
    fetchAllParallel<DepositEvent>(DEPOSITS_QUERY, 'owner', addressLower, 'Deposit', counts.depositCount, maxTimestamp),
    fetchAllParallel<WithdrawEvent>(
      WITHDRAWALS_QUERY,
      'owner',
      addressLower,
      'Withdraw',
      counts.withdrawCount,
      maxTimestamp
    ),
    fetchAllParallel<V2DepositEvent>(
      V2_DEPOSITS_QUERY,
      'recipient',
      addressLower,
      'V2Deposit',
      counts.v2DepositCount,
      maxTimestamp
    ),
    fetchAllParallel<V2WithdrawEvent>(
      V2_WITHDRAWALS_QUERY,
      'recipient',
      addressLower,
      'V2Withdraw',
      counts.v2WithdrawCount,
      maxTimestamp
    ),
    fetchAllParallel<TransferEvent>(
      TRANSFERS_IN_QUERY,
      'receiver',
      addressLower,
      'Transfer',
      counts.transferInCount,
      maxTimestamp
    ),
    fetchAllParallel<TransferEvent>(
      TRANSFERS_OUT_QUERY,
      'sender',
      addressLower,
      'Transfer',
      counts.transferOutCount,
      maxTimestamp
    )
  ]
}

function getAddressScopedEventFetchKey(
  addressLower: string,
  maxTimestamp: number | undefined,
  fetchType: HoldingsEventFetchType,
  paginationMode: HoldingsEventPaginationMode
): string {
  return `${addressLower}:${maxTimestamp ?? DEFAULT_MAX_TIMESTAMP}:${fetchType}:${paginationMode}`
}

async function fetchAddressScopedEventsUncached(
  addressLower: string,
  maxTimestamp: number | undefined,
  fetchType: HoldingsEventFetchType,
  paginationMode: HoldingsEventPaginationMode
): Promise<AddressEventResults> {
  if (paginationMode === 'all') {
    return Promise.all([
      fetchAllSingleQuery<DepositEvent>(DEPOSITS_QUERY, 'owner', addressLower, 'Deposit', maxTimestamp),
      fetchAllSingleQuery<WithdrawEvent>(WITHDRAWALS_QUERY, 'owner', addressLower, 'Withdraw', maxTimestamp),
      fetchAllSingleQuery<V2DepositEvent>(V2_DEPOSITS_QUERY, 'recipient', addressLower, 'V2Deposit', maxTimestamp),
      fetchAllSingleQuery<V2WithdrawEvent>(V2_WITHDRAWALS_QUERY, 'recipient', addressLower, 'V2Withdraw', maxTimestamp),
      fetchAllSingleQuery<TransferEvent>(TRANSFERS_IN_QUERY, 'receiver', addressLower, 'Transfer', maxTimestamp),
      fetchAllSingleQuery<TransferEvent>(TRANSFERS_OUT_QUERY, 'sender', addressLower, 'Transfer', maxTimestamp)
    ]) as Promise<AddressEventResults>
  }

  if (fetchType === 'seq') {
    return Promise.all(getSequentialAddressEventFetches(addressLower, maxTimestamp)) as Promise<AddressEventResults>
  }

  const counts = await fetchUserCounts(addressLower, maxTimestamp)
  const fetches =
    counts === null
      ? getSequentialAddressEventFetches(addressLower, maxTimestamp)
      : getParallelAddressEventFetches(addressLower, counts, maxTimestamp)

  return Promise.all(fetches) as Promise<AddressEventResults>
}

async function fetchAddressScopedEvents(
  addressLower: string,
  maxTimestamp: number | undefined,
  fetchType: HoldingsEventFetchType,
  paginationMode: HoldingsEventPaginationMode
): Promise<AddressEventResults> {
  const key = getAddressScopedEventFetchKey(addressLower, maxTimestamp, fetchType, paginationMode)
  const existing = inFlightAddressScopedEventFetches.get(key)

  if (existing) {
    debugLog('graphql', 'reusing in-flight address-scoped event fetch', {
      address: addressLower,
      maxTimestamp: maxTimestamp ?? DEFAULT_MAX_TIMESTAMP,
      fetchType,
      paginationMode
    })
    return existing
  }

  const request = fetchAddressScopedEventsUncached(addressLower, maxTimestamp, fetchType, paginationMode).finally(
    () => {
      inFlightAddressScopedEventFetches.delete(key)
    }
  )

  inFlightAddressScopedEventFetches.set(key, request)
  return request
}

function getTransactionFromEventFetches(
  addressLower: string,
  maxTimestamp: number | undefined,
  paginationMode: HoldingsEventPaginationMode
): Promise<TransactionFromEventResults> {
  const fetchFn = paginationMode === 'all' ? fetchAllSingleQuery : fetchAllSequential

  return Promise.all([
    fetchFn<DepositEvent>(DEPOSITS_BY_TX_FROM_QUERY, 'transactionFrom', addressLower, 'Deposit', maxTimestamp),
    fetchFn<WithdrawEvent>(WITHDRAWALS_BY_TX_FROM_QUERY, 'transactionFrom', addressLower, 'Withdraw', maxTimestamp),
    fetchFn<V2DepositEvent>(V2_DEPOSITS_BY_TX_FROM_QUERY, 'transactionFrom', addressLower, 'V2Deposit', maxTimestamp),
    fetchFn<V2WithdrawEvent>(
      V2_WITHDRAWALS_BY_TX_FROM_QUERY,
      'transactionFrom',
      addressLower,
      'V2Withdraw',
      maxTimestamp
    ),
    fetchFn<TransferEvent>(TRANSFERS_BY_TX_FROM_QUERY, 'transactionFrom', addressLower, 'Transfer', maxTimestamp)
  ]) as Promise<TransactionFromEventResults>
}

// Main export - defaults to sequential paged fetching but allows overrides for experimentation/debugging.
export async function fetchUserEvents(
  userAddress: string,
  version: VaultVersion = 'all',
  maxTimestamp?: number,
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged'
): Promise<UserEvents> {
  const address = getGraphqlAddress(userAddress)
  const addressLower = address.toLowerCase()

  const [v3Deposits, v3Withdrawals, v2DepositsRaw, v2WithdrawalsRaw, transfersIn, transfersOut] =
    await fetchAddressScopedEvents(address, maxTimestamp, fetchType, paginationMode)

  const processed = processEvents(
    v3Deposits,
    v3Withdrawals,
    v2DepositsRaw,
    v2WithdrawalsRaw,
    transfersIn,
    transfersOut,
    version
  )
  debugLog('graphql', 'fetched user events', {
    address: addressLower,
    version,
    fetchType,
    paginationMode,
    deposits: processed.deposits.length,
    withdrawals: processed.withdrawals.length,
    transfersIn: processed.transfersIn.length,
    transfersOut: processed.transfersOut.length,
    maxTimestamp: maxTimestamp ?? null
  })
  return processed
}

export async function fetchRawUserPnlEvents(
  userAddress: string,
  version: VaultVersion = 'all',
  maxTimestamp?: number,
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged'
): Promise<RawPnlEventContext> {
  const address = getGraphqlAddress(userAddress)
  const addressLower = address.toLowerCase()
  const addressEventsPromise = fetchAddressScopedEvents(address, maxTimestamp, fetchType, paginationMode)
  const transactionFromEventsPromise = getTransactionFromEventFetches(address, maxTimestamp, paginationMode)

  const [
    [
      addressV3Deposits,
      addressV3Withdrawals,
      addressV2DepositsRaw,
      addressV2WithdrawalsRaw,
      addressTransfersIn,
      addressTransfersOut
    ],
    [txV3Deposits, txV3Withdrawals, txV2DepositsRaw, txV2WithdrawalsRaw, txTransfers]
  ] = await Promise.all([addressEventsPromise, transactionFromEventsPromise])

  const addressEvents = {
    deposits: getDepositsByVersion(addressV3Deposits, addressV2DepositsRaw, version),
    withdrawals: getWithdrawalsByVersion(addressV3Withdrawals, addressV2WithdrawalsRaw, version),
    transfersIn: sortByBlock(addressTransfersIn),
    transfersOut: sortByBlock(addressTransfersOut)
  }
  const addressTransactionHashes = collectAddressTransactionHashes(addressEvents)
  const [txHashV3Deposits, txHashV3Withdrawals, txHashV2DepositsRaw, txHashV2WithdrawalsRaw, txHashTransfers] =
    await Promise.all([
      fetchAllByTransactionHashes<DepositEvent>(
        DEPOSITS_BY_TX_HASHES_QUERY,
        addressTransactionHashes,
        'Deposit',
        maxTimestamp
      ),
      fetchAllByTransactionHashes<WithdrawEvent>(
        WITHDRAWALS_BY_TX_HASHES_QUERY,
        addressTransactionHashes,
        'Withdraw',
        maxTimestamp
      ),
      fetchAllByTransactionHashes<V2DepositEvent>(
        V2_DEPOSITS_BY_TX_HASHES_QUERY,
        addressTransactionHashes,
        'V2Deposit',
        maxTimestamp
      ),
      fetchAllByTransactionHashes<V2WithdrawEvent>(
        V2_WITHDRAWALS_BY_TX_HASHES_QUERY,
        addressTransactionHashes,
        'V2Withdraw',
        maxTimestamp
      ),
      fetchAllByTransactionHashes<TransferEvent>(
        TRANSFERS_BY_TX_HASHES_QUERY,
        addressTransactionHashes,
        'Transfer',
        maxTimestamp
      )
    ])

  const context = {
    addressEvents,
    transactionEvents: {
      deposits: sortByBlock(
        dedupeById([
          ...getDepositsByVersion(txV3Deposits, txV2DepositsRaw, version),
          ...getDepositsByVersion(txHashV3Deposits, txHashV2DepositsRaw, version)
        ])
      ),
      withdrawals: sortByBlock(
        dedupeById([
          ...getWithdrawalsByVersion(txV3Withdrawals, txV2WithdrawalsRaw, version),
          ...getWithdrawalsByVersion(txHashV3Withdrawals, txHashV2WithdrawalsRaw, version)
        ])
      ),
      transfers: sortByBlock(dedupeById([...txTransfers, ...txHashTransfers]))
    }
  }
  debugLog('graphql', 'fetched raw user pnl events', {
    address: addressLower,
    version,
    addressDeposits: context.addressEvents.deposits.length,
    addressWithdrawals: context.addressEvents.withdrawals.length,
    addressTransfersIn: context.addressEvents.transfersIn.length,
    addressTransfersOut: context.addressEvents.transfersOut.length,
    txDeposits: context.transactionEvents.deposits.length,
    txWithdrawals: context.transactionEvents.withdrawals.length,
    txTransfers: context.transactionEvents.transfers.length,
    maxTimestamp: maxTimestamp ?? null
  })
  return context
}

// Shared processing logic for both fetch strategies
function processEvents(
  v3Deposits: DepositEvent[],
  v3Withdrawals: WithdrawEvent[],
  v2DepositsRaw: V2DepositEvent[],
  v2WithdrawalsRaw: V2WithdrawEvent[],
  transfersIn: TransferEvent[],
  transfersOut: TransferEvent[],
  version: VaultVersion
): UserEvents {
  const v2Deposits = v2DepositsRaw.map(normalizeV2Deposit)
  const v2Withdrawals = v2WithdrawalsRaw.map(normalizeV2Withdraw)

  // Build sets of vault addresses by version
  const v3VaultAddresses = new Set<string>()
  const v2VaultAddresses = new Set<string>()
  const transferOnlyVaults = new Set<string>()

  for (const d of v3Deposits) v3VaultAddresses.add(d.vaultAddress.toLowerCase())
  for (const w of v3Withdrawals) v3VaultAddresses.add(w.vaultAddress.toLowerCase())
  for (const d of v2Deposits) v2VaultAddresses.add(d.vaultAddress.toLowerCase())
  for (const w of v2Withdrawals) v2VaultAddresses.add(w.vaultAddress.toLowerCase())

  // Track vaults that only appear in transfers (no deposit/withdraw events indexed)
  // These include vaults where deposit events aren't indexed (e.g., staking vaults)
  for (const t of transfersIn) {
    const addr = t.vaultAddress.toLowerCase()
    if (!v3VaultAddresses.has(addr) && !v2VaultAddresses.has(addr)) {
      transferOnlyVaults.add(addr)
    }
  }
  for (const t of transfersOut) {
    const addr = t.vaultAddress.toLowerCase()
    if (!v3VaultAddresses.has(addr) && !v2VaultAddresses.has(addr)) {
      transferOnlyVaults.add(addr)
    }
  }

  // Filter deposits/withdrawals by version
  const deposits = getDepositsByVersion(v3Deposits, v2DepositsRaw, version)

  const withdrawals = getWithdrawalsByVersion(v3Withdrawals, v2WithdrawalsRaw, version)

  // Filter transfers by vault version
  // For "all" version, include transfer-only vaults (vaults where user has no deposits/withdrawals but received shares via transfer)
  const allowedVaults =
    version === 'v3'
      ? v3VaultAddresses
      : version === 'v2'
        ? v2VaultAddresses
        : new Set([...v3VaultAddresses, ...v2VaultAddresses, ...transferOnlyVaults])

  // Filter transfers:
  // - For vaults WITH deposit/withdraw events: exclude mints (from zero) and burns (to zero) since they're covered by Deposit/Withdraw events
  // - For transfer-only vaults: INCLUDE mints from zero address (these are deposits for vaults where Deposit events aren't indexed)
  const filteredTransfersIn = transfersIn.filter((t) => {
    const vaultAddr = t.vaultAddress.toLowerCase()
    if (!allowedVaults.has(vaultAddr)) return false

    // For transfer-only vaults, include mint events (deposits without Deposit event indexing)
    if (transferOnlyVaults.has(vaultAddr)) return true

    // For vaults with deposit events, exclude mints (they're tracked via Deposit events)
    return t.sender.toLowerCase() !== '0x0000000000000000000000000000000000000000'
  })

  const filteredTransfersOut = transfersOut.filter((t) => {
    const vaultAddr = t.vaultAddress.toLowerCase()
    if (!allowedVaults.has(vaultAddr)) return false

    // For transfer-only vaults, include burn events (withdrawals without Withdraw event indexing)
    if (transferOnlyVaults.has(vaultAddr)) return true

    // For vaults with withdraw events, exclude burns (they're tracked via Withdraw events)
    return t.receiver.toLowerCase() !== '0x0000000000000000000000000000000000000000'
  })

  return {
    deposits,
    withdrawals,
    transfersIn: filteredTransfersIn,
    transfersOut: filteredTransfersOut
  }
}
