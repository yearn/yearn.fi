import { config } from '../config'
import type { DepositEvent, TransferEvent, UserEvents, V2DepositEvent, V2WithdrawEvent, WithdrawEvent } from '../types'

// V3 Vault Queries
const DEPOSITS_QUERY = `
  query GetDeposits($owner: String!) {
    Deposit(where: { owner: { _eq: $owner } }, order_by: { blockTimestamp: asc }) {
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
  query GetWithdrawals($owner: String!) {
    Withdraw(where: { owner: { _eq: $owner } }, order_by: { blockTimestamp: asc }) {
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
  query GetTransfersIn($receiver: String!) {
    Transfer(where: { receiver: { _eq: $receiver } }, order_by: { blockTimestamp: asc }) {
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
  query GetTransfersOut($sender: String!) {
    Transfer(where: { sender: { _eq: $sender } }, order_by: { blockTimestamp: asc }) {
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

// V2 Vault Queries
const V2_DEPOSITS_QUERY = `
  query GetV2Deposits($recipient: String!) {
    V2Deposit(where: { recipient: { _eq: $recipient } }, order_by: { blockTimestamp: asc }) {
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
  query GetV2Withdrawals($recipient: String!) {
    V2Withdraw(where: { recipient: { _eq: $recipient } }, order_by: { blockTimestamp: asc }) {
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

async function executeQueryOptional<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    return await executeQuery<T>(query, variables)
  } catch (error) {
    console.warn('[GraphQL] Optional query failed (table may not exist):', error)
    return null
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

export async function fetchUserEvents(userAddress: string, version: VaultVersion = 'all'): Promise<UserEvents> {
  console.log('version', version)
  const addressLower = userAddress.toLowerCase()

  console.log(`[GraphQL] Fetching events for ${addressLower}, version: ${version}`)

  // Always fetch all deposit/withdraw events to determine vault versions
  const [depositsData, withdrawalsData, transfersInData, transfersOutData, v2DepositsData, v2WithdrawalsData] =
    await Promise.all([
      executeQuery<{ Deposit: DepositEvent[] }>(DEPOSITS_QUERY, { owner: addressLower }),
      executeQuery<{ Withdraw: WithdrawEvent[] }>(WITHDRAWALS_QUERY, { owner: addressLower }),
      executeQuery<{ Transfer: TransferEvent[] }>(TRANSFERS_IN_QUERY, { receiver: addressLower }),
      executeQuery<{ Transfer: TransferEvent[] }>(TRANSFERS_OUT_QUERY, { sender: addressLower }),
      executeQueryOptional<{ V2Deposit: V2DepositEvent[] }>(V2_DEPOSITS_QUERY, { recipient: addressLower }),
      executeQueryOptional<{ V2Withdraw: V2WithdrawEvent[] }>(V2_WITHDRAWALS_QUERY, { recipient: addressLower })
    ])

  const v3Deposits = depositsData.Deposit || []
  const v3Withdrawals = withdrawalsData.Withdraw || []
  const v2Deposits = (v2DepositsData?.V2Deposit || []).map(normalizeV2Deposit)
  const v2Withdrawals = (v2WithdrawalsData?.V2Withdraw || []).map(normalizeV2Withdraw)

  // Build sets of vault addresses by version
  const v3VaultAddresses = new Set<string>()
  const v2VaultAddresses = new Set<string>()

  for (const d of v3Deposits) v3VaultAddresses.add(d.vaultAddress.toLowerCase())
  for (const w of v3Withdrawals) v3VaultAddresses.add(w.vaultAddress.toLowerCase())
  for (const d of v2Deposits) v2VaultAddresses.add(d.vaultAddress.toLowerCase())
  for (const w of v2Withdrawals) v2VaultAddresses.add(w.vaultAddress.toLowerCase())

  console.log(`[GraphQL] V3 vaults: ${v3VaultAddresses.size}, V2 vaults: ${v2VaultAddresses.size}`)
  console.log(`[GraphQL] V3: ${v3Deposits.length} deposits, ${v3Withdrawals.length} withdrawals`)
  console.log(`[GraphQL] V2: ${v2Deposits.length} deposits, ${v2Withdrawals.length} withdrawals`)

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
  const transfersIn = transfersInData.Transfer || []
  const transfersOut = transfersOutData.Transfer || []

  const allowedVaults =
    version === 'v3'
      ? v3VaultAddresses
      : version === 'v2'
        ? v2VaultAddresses
        : new Set([...v3VaultAddresses, ...v2VaultAddresses])

  const filteredTransfersIn = transfersIn.filter(
    (t) =>
      t.sender.toLowerCase() !== '0x0000000000000000000000000000000000000000' &&
      allowedVaults.has(t.vaultAddress.toLowerCase())
  )
  const filteredTransfersOut = transfersOut.filter(
    (t) =>
      t.receiver.toLowerCase() !== '0x0000000000000000000000000000000000000000' &&
      allowedVaults.has(t.vaultAddress.toLowerCase())
  )

  console.log(`[GraphQL] Filtered transfers: ${filteredTransfersIn.length} in, ${filteredTransfersOut.length} out`)

  return {
    deposits,
    withdrawals,
    transfersIn: filteredTransfersIn,
    transfersOut: filteredTransfersOut
  }
}
