import { getAddress } from 'viem'
import { holdingsConfig } from '../config'
import {
  type DepositEvent,
  SUPPORTED_CHAINS,
  type TransferEvent,
  type UserEvents,
  type V2DepositEvent,
  type V2WithdrawEvent,
  type WithdrawEvent
} from '../types'
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
const COUNT_FREE_PARALLEL_PAGE_CONCURRENCY = 8
const SUPPORTED_CHAIN_IDS = new Set(SUPPORTED_CHAINS.map((chain) => chain.id))

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

const RECENT_DEPOSITS_QUERY = `
  query GetRecentDeposits($owner: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Deposit(where: { owner: { _eq: $owner }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: desc }, { blockNumber: desc }, { logIndex: desc }], limit: $limit, offset: $offset) {
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

const RECENT_WITHDRAWALS_QUERY = `
  query GetRecentWithdrawals($owner: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Withdraw(where: { owner: { _eq: $owner }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: desc }, { blockNumber: desc }, { logIndex: desc }], limit: $limit, offset: $offset) {
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

const RECENT_V2_DEPOSITS_QUERY = `
  query GetRecentV2Deposits($recipient: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Deposit(where: { recipient: { _eq: $recipient }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: desc }, { blockNumber: desc }, { logIndex: desc }], limit: $limit, offset: $offset) {
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

const RECENT_V2_WITHDRAWALS_QUERY = `
  query GetRecentV2Withdrawals($recipient: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Withdraw(where: { recipient: { _eq: $recipient }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: desc }, { blockNumber: desc }, { logIndex: desc }], limit: $limit, offset: $offset) {
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

const RECENT_TRANSFERS_IN_QUERY = `
  query GetRecentTransfersIn($receiver: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Transfer(where: { receiver: { _eq: $receiver }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: desc }, { blockNumber: desc }, { logIndex: desc }], limit: $limit, offset: $offset) {
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

const RECENT_TRANSFERS_OUT_QUERY = `
  query GetRecentTransfersOut($sender: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Transfer(where: { sender: { _eq: $sender }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: [{ blockTimestamp: desc }, { blockNumber: desc }, { logIndex: desc }], limit: $limit, offset: $offset) {
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

const ADDRESS_ACTIVITY_CHAIN_PRESENCE_QUERY = `
  query GetAddressActivityChainPresence($address: String!, $chainId: Int!) {
    deposits: Deposit(where: { owner: { _eq: $address }, chainId: { _eq: $chainId } }, limit: 1) {
      id
    }
    withdrawals: Withdraw(where: { owner: { _eq: $address }, chainId: { _eq: $chainId } }, limit: 1) {
      id
    }
    transfersIn: Transfer(where: { receiver: { _eq: $address }, chainId: { _eq: $chainId } }, limit: 1) {
      id
    }
    transfersOut: Transfer(where: { sender: { _eq: $address }, chainId: { _eq: $chainId } }, limit: 1) {
      id
    }
    v2Deposits: V2Deposit(where: { recipient: { _eq: $address }, chainId: { _eq: $chainId } }, limit: 1) {
      id
    }
    v2Withdrawals: V2Withdraw(where: { recipient: { _eq: $address }, chainId: { _eq: $chainId } }, limit: 1) {
      id
    }
  }
`

interface ChainPresenceQuery {
  deposits: Array<{ id: string }> | null
  withdrawals: Array<{ id: string }> | null
  transfersIn: Array<{ id: string }> | null
  transfersOut: Array<{ id: string }> | null
  v2Deposits: Array<{ id: string }> | null
  v2Withdrawals: Array<{ id: string }> | null
}

async function executeQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // Only add admin secret if explicitly configured (not the default 'testing' value)
  const password = holdingsConfig.envioPassword
  if (password && password !== 'testing') {
    headers['x-hasura-admin-secret'] = password
  }

  const response = await fetch(holdingsConfig.envioGraphqlUrl, {
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

function getGraphqlAddress(address: string): string {
  return getAddress(address)
}

function hasAnyRows(rows: Array<{ id: string }> | null | undefined): boolean {
  return Boolean(rows?.length)
}

function hasActivity(data: ChainPresenceQuery): boolean {
  return (
    hasAnyRows(data.deposits) ||
    hasAnyRows(data.withdrawals) ||
    hasAnyRows(data.transfersIn) ||
    hasAnyRows(data.transfersOut) ||
    hasAnyRows(data.v2Deposits) ||
    hasAnyRows(data.v2Withdrawals)
  )
}

export async function fetchAddressActivityChainIdsByExistence(userAddress: string): Promise<number[]> {
  const address = getGraphqlAddress(userAddress)
  const addressLower = address.toLowerCase()

  const chainPresence = await Promise.all(
    SUPPORTED_CHAINS.map(async (chain) => {
      const data = await executeQuery<ChainPresenceQuery>(ADDRESS_ACTIVITY_CHAIN_PRESENCE_QUERY, {
        address,
        chainId: chain.id
      })

      return hasActivity(data) ? chain.id : null
    })
  )

  const chainIds = chainPresence
    .filter((chainId): chainId is number => chainId !== null)
    .sort((firstChainId, secondChainId) => firstChainId - secondChainId)

  debugLog('graphql', 'loaded address activity chain presence', {
    address: addressLower,
    chainIds
  })

  return chainIds
}

// Default maxTimestamp: 10 years from now (queries require a value, can't be null)
// Using a smaller value to avoid integer overflow in GraphQL
const DEFAULT_MAX_TIMESTAMP = 2000000000 // ~year 2033, safe 32-bit integer
const TX_HASH_BATCH_SIZE = 200
const TX_HASH_QUERY_CONCURRENCY = 5

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

async function fetchParallelEventPage<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  offset: number,
  maxTimestamp?: number
): Promise<T[]> {
  const ts = maxTimestamp ?? DEFAULT_MAX_TIMESTAMP
  const startedAt = Date.now()
  const variables: Record<string, unknown> = {
    [variableKey]: address,
    limit: BATCH_SIZE,
    offset,
    maxTimestamp: ts
  }

  try {
    const data = await executeQuery<Record<string, T[]>>(query, variables)
    const batch = data[resultKey] || []

    debugLog('graphql', 'fetched count-free parallel event page', {
      resultKey,
      variableKey,
      address,
      offset,
      limit: BATCH_SIZE,
      batchCount: batch.length,
      durationMs: Date.now() - startedAt,
      maxTimestamp: ts
    })
    return batch
  } catch (error) {
    debugError('graphql', 'count-free parallel event page failed', error, {
      resultKey,
      variableKey,
      address,
      offset,
      maxTimestamp: ts
    })
    throw error
  }
}

async function fetchCountFreeParallelContinuation<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  offset: number,
  maxTimestamp?: number
): Promise<T[]> {
  const offsets = Array.from(
    { length: COUNT_FREE_PARALLEL_PAGE_CONCURRENCY },
    (_value, index) => offset + index * BATCH_SIZE
  )
  const pages = await Promise.all(
    offsets.map((pageOffset) =>
      fetchParallelEventPage<T>(query, variableKey, address, resultKey, pageOffset, maxTimestamp)
    )
  )
  const firstShortPageIndex = pages.findIndex((page) => page.length < BATCH_SIZE)
  const completePages = firstShortPageIndex === -1 ? pages : pages.slice(0, firstShortPageIndex + 1)
  const results = completePages.flat()

  if (firstShortPageIndex !== -1) {
    return results
  }

  const continuation = await fetchCountFreeParallelContinuation<T>(
    query,
    variableKey,
    address,
    resultKey,
    offset + COUNT_FREE_PARALLEL_PAGE_CONCURRENCY * BATCH_SIZE,
    maxTimestamp
  )
  return [...results, ...continuation]
}

async function fetchAllCountFreeParallel<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  maxTimestamp?: number
): Promise<T[]> {
  const firstPage = await fetchParallelEventPage<T>(query, variableKey, address, resultKey, 0, maxTimestamp)
  if (firstPage.length < BATCH_SIZE) {
    return firstPage
  }

  const continuation = await fetchCountFreeParallelContinuation<T>(
    query,
    variableKey,
    address,
    resultKey,
    BATCH_SIZE,
    maxTimestamp
  )
  return [...firstPage, ...continuation]
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

function filterSupportedAddressEventResults(eventResults: AddressEventResults): AddressEventResults {
  return eventResults.map((events) =>
    events.filter((event) => SUPPORTED_CHAIN_IDS.has(event.chainId))
  ) as AddressEventResults
}

const inFlightAddressScopedEventFetches = new Map<string, Promise<AddressEventResults>>()

function sortByBlock<T extends { blockTimestamp: number; blockNumber: number; logIndex: number }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => a.blockTimestamp - b.blockTimestamp || a.blockNumber - b.blockNumber || a.logIndex - b.logIndex
  )
}

function sortByBlockDesc<T extends { blockTimestamp: number; blockNumber: number; logIndex: number }>(
  events: T[]
): T[] {
  return [...events].sort(
    (a, b) => b.blockTimestamp - a.blockTimestamp || b.blockNumber - a.blockNumber || b.logIndex - a.logIndex
  )
}

function mergeDeposits(v3Deposits: DepositEvent[], v2DepositsRaw: V2DepositEvent[]): DepositEvent[] {
  const v2Deposits = v2DepositsRaw.map(normalizeV2Deposit)
  return sortByBlock([...v3Deposits, ...v2Deposits])
}

function mergeWithdrawals(v3Withdrawals: WithdrawEvent[], v2WithdrawalsRaw: V2WithdrawEvent[]): WithdrawEvent[] {
  const v2Withdrawals = v2WithdrawalsRaw.map(normalizeV2Withdraw)
  return sortByBlock([...v3Withdrawals, ...v2Withdrawals])
}

async function fetchRecentLimited<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  limit: number,
  offset = 0,
  maxTimestamp?: number
): Promise<T[]> {
  const ts = maxTimestamp ?? DEFAULT_MAX_TIMESTAMP
  const startedAt = Date.now()
  const variables: Record<string, unknown> = {
    [variableKey]: address,
    limit,
    offset,
    maxTimestamp: ts
  }

  try {
    const data = await executeQuery<Record<string, T[]>>(query, variables)
    const results = data[resultKey] || []

    debugLog('graphql', 'fetched recent limited event set', {
      resultKey,
      variableKey,
      address,
      count: results.length,
      durationMs: Date.now() - startedAt,
      maxTimestamp: ts,
      limit,
      offset
    })

    return results
  } catch (error) {
    debugError('graphql', 'recent limited event fetch failed', error, {
      resultKey,
      variableKey,
      address,
      maxTimestamp: ts,
      limit,
      offset
    })
    throw error
  }
}

function getCountFreeParallelAddressEventFetches(addressLower: string, maxTimestamp?: number): AddressEventFetches {
  return [
    fetchAllCountFreeParallel<DepositEvent>(DEPOSITS_QUERY, 'owner', addressLower, 'Deposit', maxTimestamp),
    fetchAllCountFreeParallel<WithdrawEvent>(WITHDRAWALS_QUERY, 'owner', addressLower, 'Withdraw', maxTimestamp),
    fetchAllCountFreeParallel<V2DepositEvent>(V2_DEPOSITS_QUERY, 'recipient', addressLower, 'V2Deposit', maxTimestamp),
    fetchAllCountFreeParallel<V2WithdrawEvent>(
      V2_WITHDRAWALS_QUERY,
      'recipient',
      addressLower,
      'V2Withdraw',
      maxTimestamp
    ),
    fetchAllCountFreeParallel<TransferEvent>(TRANSFERS_IN_QUERY, 'receiver', addressLower, 'Transfer', maxTimestamp),
    fetchAllCountFreeParallel<TransferEvent>(TRANSFERS_OUT_QUERY, 'sender', addressLower, 'Transfer', maxTimestamp)
  ]
}

function getAddressScopedEventFetchKey(addressLower: string, maxTimestamp: number | undefined): string {
  return `${addressLower}:${maxTimestamp ?? DEFAULT_MAX_TIMESTAMP}`
}

async function fetchAddressScopedEventsUncached(
  addressLower: string,
  maxTimestamp: number | undefined
): Promise<AddressEventResults> {
  return Promise.all(
    getCountFreeParallelAddressEventFetches(addressLower, maxTimestamp)
  ) as Promise<AddressEventResults>
}

async function fetchAddressScopedEvents(
  addressLower: string,
  maxTimestamp: number | undefined
): Promise<AddressEventResults> {
  const key = getAddressScopedEventFetchKey(addressLower, maxTimestamp)
  const existing = inFlightAddressScopedEventFetches.get(key)

  if (existing) {
    debugLog('graphql', 'reusing in-flight address-scoped event fetch', {
      address: addressLower,
      maxTimestamp: maxTimestamp ?? DEFAULT_MAX_TIMESTAMP
    })
    return existing
  }

  const request = fetchAddressScopedEventsUncached(addressLower, maxTimestamp)
    .then(filterSupportedAddressEventResults)
    .finally(() => {
      inFlightAddressScopedEventFetches.delete(key)
    })

  inFlightAddressScopedEventFetches.set(key, request)
  return request
}

export async function fetchUserEvents(userAddress: string, maxTimestamp?: number): Promise<UserEvents> {
  const address = getGraphqlAddress(userAddress)
  const addressLower = address.toLowerCase()

  const [v3Deposits, v3Withdrawals, v2DepositsRaw, v2WithdrawalsRaw, transfersIn, transfersOut] =
    await fetchAddressScopedEvents(address, maxTimestamp)

  const processed = processEvents(v3Deposits, v3Withdrawals, v2DepositsRaw, v2WithdrawalsRaw, transfersIn, transfersOut)
  debugLog('graphql', 'fetched user events', {
    address: addressLower,
    deposits: processed.deposits.length,
    withdrawals: processed.withdrawals.length,
    transfersIn: processed.transfersIn.length,
    transfersOut: processed.transfersOut.length,
    maxTimestamp: maxTimestamp ?? null
  })
  return processed
}

export interface RecentAddressActivityEvents {
  deposits: DepositEvent[]
  withdrawals: WithdrawEvent[]
  transfersIn: TransferEvent[]
  transfersOut: TransferEvent[]
  hasMoreDeposits: boolean
  hasMoreWithdrawals: boolean
  hasMoreTransfersIn: boolean
  hasMoreTransfersOut: boolean
}

export interface TransactionActivityEvents {
  deposits: DepositEvent[]
  withdrawals: WithdrawEvent[]
  transfers: TransferEvent[]
}

export async function fetchRecentAddressScopedActivityEvents(
  userAddress: string,
  limitPerSource = 25,
  maxTimestamp?: number,
  offsetPerSource = 0
): Promise<RecentAddressActivityEvents> {
  const address = getGraphqlAddress(userAddress)
  const addressLower = address.toLowerCase()
  const boundedLimit = Math.max(1, limitPerSource)
  const boundedOffset = Math.max(0, offsetPerSource)

  const addressEventResults: AddressEventResults = await Promise.all([
    fetchRecentLimited<DepositEvent>(
      RECENT_DEPOSITS_QUERY,
      'owner',
      address,
      'Deposit',
      boundedLimit,
      boundedOffset,
      maxTimestamp
    ),
    fetchRecentLimited<WithdrawEvent>(
      RECENT_WITHDRAWALS_QUERY,
      'owner',
      address,
      'Withdraw',
      boundedLimit,
      boundedOffset,
      maxTimestamp
    ),
    fetchRecentLimited<V2DepositEvent>(
      RECENT_V2_DEPOSITS_QUERY,
      'recipient',
      address,
      'V2Deposit',
      boundedLimit,
      boundedOffset,
      maxTimestamp
    ),
    fetchRecentLimited<V2WithdrawEvent>(
      RECENT_V2_WITHDRAWALS_QUERY,
      'recipient',
      address,
      'V2Withdraw',
      boundedLimit,
      boundedOffset,
      maxTimestamp
    ),
    fetchRecentLimited<TransferEvent>(
      RECENT_TRANSFERS_IN_QUERY,
      'receiver',
      address,
      'Transfer',
      boundedLimit,
      boundedOffset,
      maxTimestamp
    ),
    fetchRecentLimited<TransferEvent>(
      RECENT_TRANSFERS_OUT_QUERY,
      'sender',
      address,
      'Transfer',
      boundedLimit,
      boundedOffset,
      maxTimestamp
    )
  ])
  const [v3Deposits, v3Withdrawals, v2DepositsRaw, v2WithdrawalsRaw, transfersIn, transfersOut] = addressEventResults
  const supportedEventGroups = filterSupportedAddressEventResults(addressEventResults)
  const [
    supportedV3Deposits,
    supportedV3Withdrawals,
    supportedV2Deposits,
    supportedV2Withdrawals,
    supportedTransfersIn,
    supportedTransfersOut
  ] = supportedEventGroups
  const deposits = sortByBlockDesc(mergeDeposits(supportedV3Deposits, supportedV2Deposits))
  const withdrawals = sortByBlockDesc(mergeWithdrawals(supportedV3Withdrawals, supportedV2Withdrawals))
  const sortedTransfersIn = sortByBlockDesc(supportedTransfersIn)
  const sortedTransfersOut = sortByBlockDesc(supportedTransfersOut)
  const hasMoreDeposits = v3Deposits.length === boundedLimit || v2DepositsRaw.length === boundedLimit
  const hasMoreWithdrawals = v3Withdrawals.length === boundedLimit || v2WithdrawalsRaw.length === boundedLimit
  const hasMoreTransfersIn = transfersIn.length === boundedLimit
  const hasMoreTransfersOut = transfersOut.length === boundedLimit

  debugLog('graphql', 'fetched recent address-scoped activity events', {
    address: addressLower,
    limitPerSource: boundedLimit,
    deposits: deposits.length,
    withdrawals: withdrawals.length,
    transfersIn: sortedTransfersIn.length,
    transfersOut: sortedTransfersOut.length,
    hasMoreDeposits,
    hasMoreWithdrawals,
    hasMoreTransfersIn,
    hasMoreTransfersOut,
    offsetPerSource: boundedOffset,
    maxTimestamp: maxTimestamp ?? null
  })

  return {
    deposits,
    withdrawals,
    transfersIn: sortedTransfersIn,
    transfersOut: sortedTransfersOut,
    hasMoreDeposits,
    hasMoreWithdrawals,
    hasMoreTransfersIn,
    hasMoreTransfersOut
  }
}

export async function fetchActivityEventsByTransactionHashes(
  transactionHashesByChain: Map<number, string[]>,
  maxTimestamp?: number
): Promise<TransactionActivityEvents> {
  const supportedTransactionHashesByChain = new Map(
    Array.from(transactionHashesByChain).filter(([chainId]) => SUPPORTED_CHAIN_IDS.has(chainId))
  )
  const [txHashV3Deposits, txHashV3Withdrawals, txHashV2DepositsRaw, txHashV2WithdrawalsRaw, txHashTransfers] =
    await Promise.all([
      fetchAllByTransactionHashes<DepositEvent>(
        DEPOSITS_BY_TX_HASHES_QUERY,
        supportedTransactionHashesByChain,
        'Deposit',
        maxTimestamp
      ),
      fetchAllByTransactionHashes<WithdrawEvent>(
        WITHDRAWALS_BY_TX_HASHES_QUERY,
        supportedTransactionHashesByChain,
        'Withdraw',
        maxTimestamp
      ),
      fetchAllByTransactionHashes<V2DepositEvent>(
        V2_DEPOSITS_BY_TX_HASHES_QUERY,
        supportedTransactionHashesByChain,
        'V2Deposit',
        maxTimestamp
      ),
      fetchAllByTransactionHashes<V2WithdrawEvent>(
        V2_WITHDRAWALS_BY_TX_HASHES_QUERY,
        supportedTransactionHashesByChain,
        'V2Withdraw',
        maxTimestamp
      ),
      fetchAllByTransactionHashes<TransferEvent>(
        TRANSFERS_BY_TX_HASHES_QUERY,
        supportedTransactionHashesByChain,
        'Transfer',
        maxTimestamp
      )
    ])

  return {
    deposits: sortByBlock(dedupeById(mergeDeposits(txHashV3Deposits, txHashV2DepositsRaw))),
    withdrawals: sortByBlock(dedupeById(mergeWithdrawals(txHashV3Withdrawals, txHashV2WithdrawalsRaw))),
    transfers: sortByBlock(dedupeById(txHashTransfers))
  }
}

// Shared processing logic for both fetch strategies
function processEvents(
  v3Deposits: DepositEvent[],
  v3Withdrawals: WithdrawEvent[],
  v2DepositsRaw: V2DepositEvent[],
  v2WithdrawalsRaw: V2WithdrawEvent[],
  transfersIn: TransferEvent[],
  transfersOut: TransferEvent[]
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

  const deposits = mergeDeposits(v3Deposits, v2DepositsRaw)
  const withdrawals = mergeWithdrawals(v3Withdrawals, v2WithdrawalsRaw)

  const allowedVaults = new Set([...v3VaultAddresses, ...v2VaultAddresses, ...transferOnlyVaults])

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
