import { config } from '../config'
import type { DepositEvent, TransferEvent, UserEvents, V2DepositEvent, V2WithdrawEvent, WithdrawEvent } from '../types'

// V3 Vault Queries (with optional maxTimestamp filter)
const DEPOSITS_QUERY = `
  query GetDeposits($owner: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Deposit(where: { owner: { _eq: $owner }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: { blockTimestamp: asc }, limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      owner
      assets
      shares
    }
  }
`

const WITHDRAWALS_QUERY = `
  query GetWithdrawals($owner: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Withdraw(where: { owner: { _eq: $owner }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: { blockTimestamp: asc }, limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      owner
      assets
      shares
    }
  }
`

const TRANSFERS_IN_QUERY = `
  query GetTransfersIn($receiver: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Transfer(where: { receiver: { _eq: $receiver }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: { blockTimestamp: asc }, limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      sender
      receiver
      value
    }
  }
`

const TRANSFERS_OUT_QUERY = `
  query GetTransfersOut($sender: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    Transfer(where: { sender: { _eq: $sender }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: { blockTimestamp: asc }, limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      sender
      receiver
      value
    }
  }
`

const BATCH_SIZE = 1000

// V2 Vault Queries (with optional maxTimestamp filter)
const V2_DEPOSITS_QUERY = `
  query GetV2Deposits($recipient: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Deposit(where: { recipient: { _eq: $recipient }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: { blockTimestamp: asc }, limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      recipient
      amount
      shares
    }
  }
`

const V2_WITHDRAWALS_QUERY = `
  query GetV2Withdrawals($recipient: String!, $limit: Int!, $offset: Int!, $maxTimestamp: Int) {
    V2Withdraw(where: { recipient: { _eq: $recipient }, blockTimestamp: { _lte: $maxTimestamp } }, order_by: { blockTimestamp: asc }, limit: $limit, offset: $offset) {
      id
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      recipient
      amount
      shares
    }
  }
`

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

async function fetchCount(
  tableName: string,
  variableKey: string,
  address: string,
  maxTimestamp?: number
): Promise<number> {
  const timestampFilter = maxTimestamp ? `, blockTimestamp: { _lte: ${maxTimestamp} }` : ''
  const query = `query($${variableKey}: String!) { ${tableName}_aggregate(where: { ${variableKey}: { _eq: $${variableKey} }${timestampFilter} }) { aggregate { count } } }`
  const data = await executeQuery<Record<string, { aggregate: { count: number } }>>(query, { [variableKey]: address })
  return data[tableName + '_aggregate']?.aggregate?.count ?? 0
}

async function fetchAllPaginated<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  maxTimestamp?: number
): Promise<T[]> {
  const count = await fetchCount(resultKey, variableKey, address, maxTimestamp)

  if (count === 0) {
    return []
  }

  const batchCount = Math.ceil(count / BATCH_SIZE)
  const offsets = Array.from({ length: batchCount }, (_, i) => i * BATCH_SIZE)

  const batchResults = await Promise.all(
    offsets.map(async (offset) => {
      const variables: Record<string, unknown> = { [variableKey]: address, limit: BATCH_SIZE, offset }
      if (maxTimestamp) variables.maxTimestamp = maxTimestamp
      const data = await executeQuery<Record<string, T[]>>(query, variables)
      return data[resultKey] || []
    })
  )

  return batchResults.flat()
}

async function fetchAllPaginatedOptional<T>(
  query: string,
  variableKey: string,
  address: string,
  resultKey: string,
  maxTimestamp?: number
): Promise<T[]> {
  try {
    return await fetchAllPaginated<T>(query, variableKey, address, resultKey, maxTimestamp)
  } catch {
    return []
  }
}

function normalizeV2Deposit(v2: V2DepositEvent): DepositEvent {
  return {
    id: v2.id,
    vaultAddress: v2.vaultAddress,
    chainId: v2.chainId,
    blockNumber: v2.blockNumber,
    blockTimestamp: v2.blockTimestamp,
    owner: v2.recipient,
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
    owner: v2.recipient,
    assets: v2.amount,
    shares: v2.shares
  }
}

export type VaultVersion = 'v2' | 'v3' | 'all'

export async function fetchUserEvents(
  userAddress: string,
  version: VaultVersion = 'all',
  maxTimestamp?: number
): Promise<UserEvents> {
  const addressLower = userAddress.toLowerCase()

  // Fetch events with pagination (deployed indexers often have 1000 result limit)
  // If maxTimestamp provided, only fetch events up to that point
  const [v3Deposits, v3Withdrawals, v2DepositsRaw, v2WithdrawalsRaw, transfersIn, transfersOut] = await Promise.all([
    fetchAllPaginated<DepositEvent>(DEPOSITS_QUERY, 'owner', addressLower, 'Deposit', maxTimestamp),
    fetchAllPaginated<WithdrawEvent>(WITHDRAWALS_QUERY, 'owner', addressLower, 'Withdraw', maxTimestamp),
    fetchAllPaginatedOptional<V2DepositEvent>(V2_DEPOSITS_QUERY, 'recipient', addressLower, 'V2Deposit', maxTimestamp),
    fetchAllPaginatedOptional<V2WithdrawEvent>(
      V2_WITHDRAWALS_QUERY,
      'recipient',
      addressLower,
      'V2Withdraw',
      maxTimestamp
    ),
    fetchAllPaginated<TransferEvent>(TRANSFERS_IN_QUERY, 'receiver', addressLower, 'Transfer', maxTimestamp),
    fetchAllPaginated<TransferEvent>(TRANSFERS_OUT_QUERY, 'sender', addressLower, 'Transfer', maxTimestamp)
  ])

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
  const deposits =
    version === 'v3'
      ? v3Deposits
      : version === 'v2'
        ? v2Deposits
        : [...v3Deposits, ...v2Deposits].sort((a, b) => a.blockTimestamp - b.blockTimestamp)

  const withdrawals =
    version === 'v3'
      ? v3Withdrawals
      : version === 'v2'
        ? v2Withdrawals
        : [...v3Withdrawals, ...v2Withdrawals].sort((a, b) => a.blockTimestamp - b.blockTimestamp)

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
