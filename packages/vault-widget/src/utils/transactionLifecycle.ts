import { type Hash, type TransactionReceipt, TransactionReceiptNotFoundError } from 'viem'

export const TRANSACTION_REFRESH_TIMEOUT_MS = 10_000

export function getTransactionConfirmations(canonicalChainId: number | undefined): number {
  return canonicalChainId === 8453 ? 2 : 1
}

type TReceiptClient = {
  getBlockNumber: () => Promise<bigint>
  getTransactionReceipt: (parameters: { hash: Hash }) => Promise<TransactionReceipt>
}

export async function getConfirmedTransactionReceipt(
  client: TReceiptClient,
  hash: Hash,
  confirmations: number
): Promise<TransactionReceipt | null> {
  const receipt = await client.getTransactionReceipt({ hash }).catch((error: unknown) => {
    if (error instanceof TransactionReceiptNotFoundError) return null
    throw error
  })
  if (!receipt) return null
  if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase()) {
    throw new Error('Received a receipt for an unexpected transaction')
  }
  if (confirmations <= 1) return receipt
  const latestBlock = await client.getBlockNumber()
  return latestBlock >= receipt.blockNumber + BigInt(confirmations - 1) ? receipt : null
}

// A refresh is a follow-up to confirmation. Its failure must never trigger another send.
export async function awaitTransactionRefresh(refresh: () => Promise<void>): Promise<void> {
  const timer: { id?: ReturnType<typeof setTimeout> } = {}
  try {
    await Promise.race([
      Promise.resolve().then(refresh),
      new Promise<never>((_, reject) => {
        timer.id = setTimeout(() => reject(new Error('Balance refresh timed out')), TRANSACTION_REFRESH_TIMEOUT_MS)
      })
    ])
  } finally {
    clearTimeout(timer.id)
  }
}

export class VaultWidgetPreparationError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Transaction preparation failed', { cause })
    this.name = 'VaultWidgetPreparationError'
  }
}
