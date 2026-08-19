import type { Config } from '@wagmi/core'
import {
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
  type Hash,
  isHash,
  isHex,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError
} from 'viem'

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

      await publicClient.call({
        account,
        data: request.data,
        to: request.to,
        value: request.value ?? 0n
      })
      const hash = await sendTransaction(options.config, {
        account,
        chainId: executionChainId,
        data: request.data,
        to: request.to,
        value: request.value ?? 0n
      })
      if (!isTransactionHash(hash)) throw new Error('Wallet returned an invalid transaction hash')
      return hash
    },
    async waitForReceipt({ chainId, hash }) {
      const executionChainId = requireExecutionChainId(chainId)
      const publicClient = getPublicClient(options.config, { chainId: executionChainId })
      if (!publicClient) throw new Error(`No public client is configured for chain ${executionChainId}`)

      const receipt = await publicClient.waitForTransactionReceipt({
        confirmations: requireConfirmations(chainId),
        hash
      })
      if (!isTransactionHash(receipt.transactionHash)) {
        throw new Error('Wallet returned an invalid transaction receipt')
      }
      if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase()) {
        throw new Error('Wallet returned a receipt for an unexpected transaction')
      }
      return receipt
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
