import { type Hash, MethodNotFoundRpcError, MethodNotSupportedRpcError } from 'viem'
import {
  getAccount,
  getCallsStatus,
  getPublicClient,
  sendCalls,
  sendTransaction,
  waitForTransactionReceipt
} from 'wagmi/actions'
import type { VaultWidgetExecutionService, VaultWidgetSafeProposalContext, VaultWidgetWalletContext } from './types'

type SafeAwareExecutionOptions = {
  eoa?: VaultWidgetExecutionService
  isSafe: (context: VaultWidgetWalletContext) => Promise<boolean>
  propose: (context: VaultWidgetSafeProposalContext) => Promise<`0x${string}`>
  waitForExecution: NonNullable<VaultWidgetExecutionService['waitForSafeExecution']>
}

type WagmiSafeExecutionOptions = {
  isSafeConnector?: (connectorId?: string) => boolean
  pollIntervalMs?: number
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
}

function isAtomicSimulationUnavailable(error: unknown): boolean {
  return error instanceof MethodNotFoundRpcError || error instanceof MethodNotSupportedRpcError
}

function isTransactionHash(value: unknown): value is Hash {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

async function simulateSafeBatch({
  account,
  chainId,
  config,
  requests
}: VaultWidgetSafeProposalContext): Promise<void> {
  const publicClient = getPublicClient(config, { chainId })
  if (!publicClient) throw new Error(`No public client is configured for chain ${chainId}`)

  try {
    const [block] = await publicClient.simulateBlocks({
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
    if (!block || block.calls.length !== requests.length) {
      throw new Error('Safe batch simulation returned incomplete results')
    }
    const failedCall = block.calls.find(({ status }) => status === 'failure')
    if (failedCall?.status === 'failure') {
      throw failedCall.error ?? new Error('Safe batch simulation failed')
    }
  } catch (error) {
    // Most canonical RPCs do not expose eth_simulateV1 yet. In that case the
    // Safe wallet remains the final atomic simulation boundary.
    if (isAtomicSimulationUnavailable(error)) return
    throw error
  }
}

export function createWagmiExecutionService(): VaultWidgetExecutionService {
  return {
    async execute({ account, config, request }) {
      const publicClient = getPublicClient(config, { chainId: request.chainId })
      if (!publicClient) throw new Error(`No public client is configured for chain ${request.chainId}`)
      await publicClient.call({
        account,
        data: request.data,
        to: request.to,
        value: request.value ?? 0n
      })
      return sendTransaction(config, {
        account,
        chainId: request.chainId,
        data: request.data,
        to: request.to,
        value: request.value ?? 0n
      })
    },
    async waitForReceipt(config, chainId, hash): Promise<void> {
      const receipt = await waitForTransactionReceipt(config, { chainId, hash })
      if (receipt.status !== 'success') {
        throw new Error('Transaction reverted')
      }
    }
  }
}

export function createSafeAwareExecutionService(options: SafeAwareExecutionOptions): VaultWidgetExecutionService {
  const eoa = options.eoa ?? createWagmiExecutionService()

  return {
    async getWalletType(context) {
      return (await options.isSafe(context)) ? 'safe' : 'eoa'
    },
    execute: eoa.execute,
    waitForReceipt: eoa.waitForReceipt,
    proposeSafeBatch: options.propose,
    waitForSafeExecution: options.waitForExecution
  }
}

export function createWagmiSafeExecutionService(options: WagmiSafeExecutionOptions = {}): VaultWidgetExecutionService {
  const isSafeConnector = options.isSafeConnector ?? ((connectorId?: string) => connectorId?.toLowerCase() === 'safe')
  const pollIntervalMs = options.pollIntervalMs ?? 1_500

  async function waitForSafeExecution(
    config: Parameters<NonNullable<VaultWidgetExecutionService['waitForSafeExecution']>>[0],
    chainId: number,
    proposalId: `0x${string}`
  ): Promise<Hash> {
    const status = await getCallsStatus(config, { id: proposalId })
    if (status.status === 'failure') throw new Error('Safe transaction failed')
    if (status.status === 'success') {
      const hash = status.receipts?.at(-1)?.transactionHash
      if (!isTransactionHash(hash)) throw new Error('Safe execution completed without a valid transaction receipt')
      return hash
    }
    await wait(pollIntervalMs)
    return waitForSafeExecution(config, chainId, proposalId)
  }

  return createSafeAwareExecutionService({
    async isSafe({ config }) {
      return isSafeConnector(getAccount(config).connector?.id)
    },
    async propose(context) {
      const { account, chainId, config, requests } = context
      await simulateSafeBatch(context)
      const result = await sendCalls(config, {
        account,
        calls: requests.map(({ data, to, value }) => ({ data, to, value })),
        chainId,
        forceAtomic: true
      })
      if (!result.id.startsWith('0x')) throw new Error('Safe returned an invalid proposal identifier')
      return result.id as `0x${string}`
    },
    waitForExecution: waitForSafeExecution
  })
}
