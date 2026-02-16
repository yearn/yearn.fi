import { config } from '../config'
import type { DepositEvent, TransferEvent, UserEvents, WithdrawEvent } from '../types'

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

async function executeQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(config.envioGraphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': config.envioPassword
    },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`)
  }

  const json = await response.json()

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
  }

  return json.data
}

export async function fetchUserEvents(userAddress: string): Promise<UserEvents> {
  const addressLower = userAddress.toLowerCase()

  const [depositsData, withdrawalsData, transfersInData, transfersOutData] = await Promise.all([
    executeQuery<{ Deposit: DepositEvent[] }>(DEPOSITS_QUERY, { owner: addressLower }),
    executeQuery<{ Withdraw: WithdrawEvent[] }>(WITHDRAWALS_QUERY, { owner: addressLower }),
    executeQuery<{ Transfer: TransferEvent[] }>(TRANSFERS_IN_QUERY, { receiver: addressLower }),
    executeQuery<{ Transfer: TransferEvent[] }>(TRANSFERS_OUT_QUERY, { sender: addressLower })
  ])

  const deposits = depositsData.Deposit || []
  const withdrawals = withdrawalsData.Withdraw || []
  const transfersIn = transfersInData.Transfer || []
  const transfersOut = transfersOutData.Transfer || []

  const filteredTransfersIn = transfersIn.filter(
    (t) => t.sender.toLowerCase() !== '0x0000000000000000000000000000000000000000'
  )
  const filteredTransfersOut = transfersOut.filter(
    (t) => t.receiver.toLowerCase() !== '0x0000000000000000000000000000000000000000'
  )

  return {
    deposits,
    withdrawals,
    transfersIn: filteredTransfersIn,
    transfersOut: filteredTransfersOut
  }
}
