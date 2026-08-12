import { type Hash, type TransactionReceipt, TransactionReceiptNotFoundError } from 'viem'

type ReceiptClient = {
  getBlockNumber: () => Promise<bigint>
  getTransactionReceipt: (parameters: { hash: Hash }) => Promise<TransactionReceipt>
}

export async function getConfirmedTransactionReceipt(
  client: ReceiptClient,
  hash: Hash,
  confirmations: number
): Promise<TransactionReceipt | null> {
  let receipt: TransactionReceipt
  try {
    receipt = await client.getTransactionReceipt({ hash })
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return null
    throw error
  }

  if (confirmations <= 1) return receipt
  const latestBlock = await client.getBlockNumber()
  const confirmedAtBlock = receipt.blockNumber + BigInt(confirmations - 1)
  return latestBlock >= confirmedAtBlock ? receipt : null
}
