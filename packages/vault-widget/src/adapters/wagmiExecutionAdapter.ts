import type { Config } from '@wagmi/core'
import {
  getAccount,
  getConnectorClient,
  getPublicClient,
  sendCalls,
  sendTransaction,
  switchChain as wagmiSwitchChain,
  waitForCallsStatus
} from '@wagmi/core/actions'
import type { VaultWidgetExecutionAdapter, VaultWidgetTransactionRequest } from '@yearn/vault-widget/headless'
import {
  type Address,
  BaseError,
  type Client,
  type Hash,
  type Hex,
  isHash,
  isHex,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError,
  type ReplacementReturnType,
  type Transaction,
  TransactionNotFoundError
} from 'viem'
import {
  getTransaction,
  getTransactionCount,
  waitForTransactionReceipt as viemWaitForTransactionReceipt
} from 'viem/actions'

export type TWagmiVaultWidgetExecutionAdapterOptions = {
  config: Config
  resolveConfirmations?: (canonicalChainId: number) => number
  resolveExecutionChainId?: (canonicalChainId: number) => number | undefined
  safePollingIntervalMs?: number
  safeTimeoutMs?: number
}

type TSafeBatchSimulationParameters = {
  account: Address
  executionChainId: number
  requests: readonly VaultWidgetTransactionRequest[]
}

type TSubmittedTransactionIdentity = Pick<
  Transaction,
  'blockNumber' | 'from' | 'hash' | 'input' | 'nonce' | 'to' | 'transactionIndex' | 'value'
>

type TSubmittedTransactionContext = {
  connectorClient: Client
  identity?: TSubmittedTransactionIdentity
}

const TRANSACTION_IDENTITY_TIMEOUT_MS = 3_000

function isAtomicSimulationUnavailable(error: unknown): boolean {
  if (error instanceof MethodNotFoundRpcError || error instanceof MethodNotSupportedRpcError) return true
  if (!(error instanceof BaseError)) return false

  return Boolean(
    error.walk((cause) => cause instanceof MethodNotFoundRpcError || cause instanceof MethodNotSupportedRpcError)
  )
}

function isTransactionHash(value: unknown): value is Hash {
  return typeof value === 'string' && isHash(value)
}

function getSubmittedTransactionKey(executionChainId: number, hash: Hash): string {
  return `${executionChainId}:${hash.toLowerCase()}`
}

function normalizeAddress(address: Address): Address {
  return address.toLowerCase() as Address
}

// Viem compares replacement identity fields as exact strings. Wallet-local
// transactions can be checksummed while RPC block transactions are lowercase.
function normalizeTransactionIdentity(transaction: Transaction): Transaction {
  return {
    ...transaction,
    from: normalizeAddress(transaction.from),
    input: transaction.input.toLowerCase() as Hex,
    to: transaction.to ? normalizeAddress(transaction.to) : null
  }
}

function createSubmittedTransactionIdentity({
  account,
  hash,
  nonce,
  request
}: {
  account: Address
  hash: Hash
  nonce: number
  request: VaultWidgetTransactionRequest
}): TSubmittedTransactionIdentity {
  return {
    blockNumber: null,
    from: normalizeAddress(account),
    hash,
    input: request.data.toLowerCase() as Hex,
    nonce,
    to: normalizeAddress(request.to),
    transactionIndex: null,
    value: request.value ?? 0n
  }
}

async function getKnownTransaction(operation: () => Promise<Transaction>): Promise<Transaction | undefined> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof TransactionNotFoundError) return undefined
    throw error
  }
}

async function getBoundedTransactionNonce(client: Client, account: Address): Promise<number | undefined> {
  return Promise.race([
    getTransactionCount(client, { address: account, blockTag: 'pending' }).catch(() => undefined),
    new Promise<undefined>((resolve) => {
      setTimeout(() => resolve(undefined), TRANSACTION_IDENTITY_TIMEOUT_MS)
    })
  ])
}

function isValidTransactionNonce(nonce: number | undefined): nonce is number {
  return nonce !== undefined && Number.isSafeInteger(nonce) && nonce >= 0
}

async function getExpectedTransactionNonce({
  account,
  connectorClient,
  publicClient
}: {
  account: Address
  connectorClient: Client
  publicClient: Client
}): Promise<number | undefined> {
  const [connectorNonce, publicNonce] = await Promise.all([
    getBoundedTransactionNonce(connectorClient, account),
    getBoundedTransactionNonce(publicClient, account)
  ])
  if (isValidTransactionNonce(connectorNonce)) return connectorNonce
  return isValidTransactionNonce(publicNonce) ? publicNonce : undefined
}

function requireDuration(name: string, value: number, allowZero: boolean): number {
  const minimum = allowZero ? 0 : 1
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be ${allowZero ? 'a non-negative' : 'a positive'} integer`)
  }
  return value
}

export function createWagmiVaultWidgetExecutionAdapter(
  options: TWagmiVaultWidgetExecutionAdapterOptions
): VaultWidgetExecutionAdapter {
  const resolveExecutionChainId = options.resolveExecutionChainId ?? ((chainId: number) => chainId)
  const safePollingIntervalMs = requireDuration('safePollingIntervalMs', options.safePollingIntervalMs ?? 1_500, true)
  const safeTimeoutMs = requireDuration('safeTimeoutMs', options.safeTimeoutMs ?? 60_000, false)
  const submittedTransactions = new Map<string, TSubmittedTransactionContext>()

  function requireExecutionChainId(canonicalChainId: number): number {
    const executionChainId = resolveExecutionChainId(canonicalChainId)
    if (!Number.isSafeInteger(executionChainId) || Number(executionChainId) <= 0) {
      throw new Error(`Chain ${canonicalChainId} is not enabled for execution`)
    }
    return executionChainId as number
  }

  function requireConfirmations(canonicalChainId: number): number {
    return requireDuration('confirmations', options.resolveConfirmations?.(canonicalChainId) ?? 1, false)
  }

  async function simulateSafeBatch({
    account,
    executionChainId,
    requests
  }: TSafeBatchSimulationParameters): Promise<void> {
    const publicClient = getPublicClient(options.config, { chainId: executionChainId })
    if (!publicClient) throw new Error(`No public client is configured for chain ${executionChainId}`)

    try {
      const blocks = await publicClient.simulateBlocks({
        blocks: [
          {
            calls: requests.map(({ data, to, value }) => ({
              account,
              data,
              to,
              value: value ?? 0n
            }))
          }
        ]
      })
      const block = blocks[0]
      if (blocks.length !== 1 || !block || block.calls.length !== requests.length) {
        throw new Error('Safe batch simulation returned incomplete results')
      }

      const failedCall = block.calls.find(({ status }) => status === 'failure')
      if (failedCall?.status === 'failure') {
        throw failedCall.error ?? new Error('Safe batch simulation failed')
      }
    } catch (error) {
      if (isAtomicSimulationUnavailable(error)) return
      throw error
    }
  }

  return {
    async switchChain({ chainId }) {
      await wagmiSwitchChain(options.config, { chainId: requireExecutionChainId(chainId) })
    },
    async execute({ account, request }) {
      const executionChainId = requireExecutionChainId(request.chainId)
      const publicClient = getPublicClient(options.config, { chainId: executionChainId })
      if (!publicClient) throw new Error(`No public client is configured for chain ${executionChainId}`)
      const connector = getAccount(options.config).connector
      if (!connector) throw new Error('No wallet connector is available for execution')

      const connectorClientPromise = getConnectorClient(options.config, {
        account,
        assertChainId: false,
        chainId: executionChainId,
        connector
      })
      const [gasEstimate, connectorClient] = await Promise.all([
        publicClient.estimateGas({
          account,
          data: request.data,
          to: request.to,
          value: request.value ?? 0n
        }),
        connectorClientPromise
      ])
      const expectedNoncePromise = getExpectedTransactionNonce({
        account,
        connectorClient: connectorClient as Client,
        publicClient: publicClient as Client
      })
      const hash = await sendTransaction(options.config, {
        account,
        chainId: executionChainId,
        data: request.data,
        gas: (gasEstimate * 110n) / 100n,
        connector,
        to: request.to,
        value: request.value ?? 0n
      })
      if (!isTransactionHash(hash)) throw new Error('Wallet returned an invalid transaction hash')
      const expectedNonce = await expectedNoncePromise
      submittedTransactions.set(getSubmittedTransactionKey(executionChainId, hash), {
        connectorClient: connectorClient as Client,
        ...(expectedNonce !== undefined
          ? { identity: createSubmittedTransactionIdentity({ account, hash, nonce: expectedNonce, request }) }
          : {})
      })
      return hash
    },
    async waitForReceipt({ chainId, hash }) {
      const executionChainId = requireExecutionChainId(chainId)
      const publicClient = getPublicClient(options.config, { chainId: executionChainId })
      if (!publicClient) throw new Error(`No public client is configured for chain ${executionChainId}`)
      const transactionKey = getSubmittedTransactionKey(executionChainId, hash)
      const submittedTransaction = submittedTransactions.get(transactionKey)
      const observedReplacement: { current?: ReplacementReturnType } = {}
      const usedSubmittedIdentity = { current: false }
      const confirmations = requireConfirmations(chainId)
      const waitParameters = {
        confirmations: 1,
        hash,
        onReplaced: (replacement: ReplacementReturnType) => {
          observedReplacement.current = replacement
        },
        timeout: 0
      }

      try {
        const detectedReceipt = await (async () => {
          if (!submittedTransaction) return publicClient.waitForTransactionReceipt(waitParameters)

          const replacementAwareClient = {
            ...publicClient,
            getBlock: async (parameters: Parameters<typeof publicClient.getBlock>[0]) => {
              const block = await publicClient.getBlock(parameters)
              return {
                ...block,
                transactions: block.transactions.map((transaction) =>
                  typeof transaction === 'string' ? transaction : normalizeTransactionIdentity(transaction)
                )
              }
            },
            getTransaction: async ({ hash: requestedHash }: { hash: Hash }) => {
              const publicTransaction = await getKnownTransaction(() =>
                publicClient.getTransaction({ hash: requestedHash })
              )
              if (publicTransaction) return normalizeTransactionIdentity(publicTransaction)
              if (requestedHash.toLowerCase() !== hash.toLowerCase()) {
                throw new TransactionNotFoundError({ hash: requestedHash })
              }

              const connectorTransaction = await getKnownTransaction(() =>
                getTransaction(submittedTransaction.connectorClient, { hash: requestedHash })
              )
              if (connectorTransaction) return normalizeTransactionIdentity(connectorTransaction)
              if (submittedTransaction.identity) {
                usedSubmittedIdentity.current = true
                return submittedTransaction.identity as Transaction
              }
              throw new TransactionNotFoundError({ hash: requestedHash })
            }
          }
          return viemWaitForTransactionReceipt(replacementAwareClient, waitParameters)
        })()

        if (!isTransactionHash(detectedReceipt.transactionHash)) {
          throw new Error('Wallet returned an invalid transaction receipt')
        }
        const receipt =
          confirmations === 1
            ? detectedReceipt
            : await publicClient.waitForTransactionReceipt({
                checkReplacement: false,
                confirmations,
                hash: detectedReceipt.transactionHash,
                timeout: 0
              })

        if (!isTransactionHash(receipt.transactionHash)) {
          throw new Error('Wallet returned an invalid transaction receipt')
        }

        const replacement = observedReplacement.current
        if (receipt.transactionHash.toLowerCase() === hash.toLowerCase()) {
          if (replacement) throw new Error('Wallet returned invalid transaction replacement details')
          return { receipt }
        }

        if (
          !replacement ||
          !isTransactionHash(replacement.replacedTransaction.hash) ||
          replacement.replacedTransaction.hash.toLowerCase() !== hash.toLowerCase() ||
          !isTransactionHash(replacement.transaction.hash) ||
          replacement.transaction.hash.toLowerCase() !== receipt.transactionHash.toLowerCase() ||
          !isTransactionHash(replacement.transactionReceipt.transactionHash) ||
          replacement.transactionReceipt.transactionHash.toLowerCase() !== receipt.transactionHash.toLowerCase()
        ) {
          throw new Error('Wallet returned a receipt for an unexpected transaction')
        }
        if (usedSubmittedIdentity.current && replacement.reason === 'replaced') {
          throw new Error('Wallet returned an unverifiable transaction replacement')
        }

        return {
          receipt,
          replacement: {
            reason: replacement.reason,
            replacedHash: hash
          }
        }
      } finally {
        submittedTransactions.delete(transactionKey)
      }
    },
    async proposeSafeBatch({ account, chainId, requests }) {
      if (requests.length === 0) throw new Error('Safe batch cannot be empty')
      if (requests.some((request) => request.chainId !== chainId)) {
        throw new Error('Safe batch contains requests from different canonical chains')
      }

      const executionChainId = requireExecutionChainId(chainId)
      await simulateSafeBatch({ account, executionChainId, requests })
      const result = await sendCalls(options.config, {
        account,
        calls: requests.map(({ data, to, value }) => ({ data, to, value })),
        chainId: executionChainId,
        forceAtomic: true
      })
      if (!isHex(result.id) || result.id === '0x') {
        throw new Error('Safe returned an invalid proposal identifier')
      }
      return result.id
    },
    async waitForSafeExecution({ chainId, proposalId }) {
      const executionChainId = requireExecutionChainId(chainId)
      const status = await waitForCallsStatus(options.config, {
        id: proposalId,
        pollingInterval: safePollingIntervalMs,
        timeout: safeTimeoutMs
      })
      if (status.chainId !== undefined && status.chainId !== executionChainId) {
        throw new Error('Safe execution completed on an unexpected chain')
      }
      if (status.status === 'failure') throw new Error('Safe transaction failed')
      if (status.status !== 'success') {
        throw new Error('Safe execution completed without a successful status')
      }

      const receipts = status.receipts ?? []
      const receipt = receipts.at(-1)
      if (receipts.some(({ status: receiptStatus }) => receiptStatus !== 'success')) {
        throw new Error('Safe execution completed with a reverted transaction receipt')
      }
      if (!isTransactionHash(receipt?.transactionHash)) {
        throw new Error('Safe execution completed without a valid transaction receipt')
      }
      return receipt.transactionHash
    }
  }
}
