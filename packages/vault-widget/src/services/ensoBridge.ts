import type {
  EnsoBridgeStatus,
  EnsoBridgeStatusName,
  EnsoBridgeStatusProvider,
  EnsoBridgeStatusRequest
} from '../types'

type HttpEnsoBridgeStatusProviderOptions = {
  endpoint?: string
  fetcher?: typeof fetch
  maxAttempts?: number
  pollIntervalMs?: number
  waiter?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
}

type EnsoBridgeStatusPayload = {
  destinationChainId?: unknown
  destinationTxHash?: unknown
  error?: unknown
  sourceChainId?: unknown
  sourceTxHash?: unknown
  status?: unknown
}

const BRIDGE_STATUSES = ['pending', 'inflight', 'delivered', 'failed', 'unknown'] as const

function isHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function isBridgeStatus(value: unknown): value is EnsoBridgeStatusName {
  return typeof value === 'string' && BRIDGE_STATUSES.some((status) => status === value)
}

export function normalizeEnsoBridgeStatus(payload: unknown, request: EnsoBridgeStatusRequest): EnsoBridgeStatus {
  if (!payload || typeof payload !== 'object') throw new Error('Enso returned an invalid bridge status')
  const status = payload as EnsoBridgeStatusPayload
  if (!isBridgeStatus(status.status)) throw new Error('Enso returned an unknown bridge status')
  if (status.sourceChainId !== undefined && status.sourceChainId !== request.sourceChainId) {
    throw new Error('Enso bridge status returned a different source chain')
  }
  if (
    status.sourceTxHash !== undefined &&
    (!isHash(status.sourceTxHash) || status.sourceTxHash.toLowerCase() !== request.sourceTxHash.toLowerCase())
  ) {
    throw new Error('Enso bridge status returned a different source transaction')
  }
  if (status.destinationChainId !== undefined && status.destinationChainId !== request.destinationChainId) {
    throw new Error('Enso bridge status returned a different destination chain')
  }
  if (status.destinationTxHash !== undefined && !isHash(status.destinationTxHash)) {
    throw new Error('Enso bridge status returned an invalid destination transaction')
  }

  return {
    destinationChainId: typeof status.destinationChainId === 'number' ? status.destinationChainId : undefined,
    destinationTxHash: status.destinationTxHash,
    error: typeof status.error === 'string' ? status.error : undefined,
    sourceChainId: request.sourceChainId,
    sourceTxHash: request.sourceTxHash,
    status: status.status
  }
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Bridge status polling was cancelled'))
      return
    }
    const onAbort = (): void => {
      globalThis.clearTimeout(timeout)
      reject(signal?.reason ?? new Error('Bridge status polling was cancelled'))
    }
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function createHttpEnsoBridgeStatusProvider(
  options: HttpEnsoBridgeStatusProviderOptions = {}
): EnsoBridgeStatusProvider {
  const endpoint = options.endpoint ?? '/api/enso/bridge-status'
  const fetcher = options.fetcher ?? fetch
  const pollIntervalMs = Math.max(10_000, options.pollIntervalMs ?? 10_000)
  const waiter = options.waiter ?? wait

  return {
    async waitForCompletion(request, onStatus): Promise<EnsoBridgeStatus> {
      async function poll(attempt: number): Promise<EnsoBridgeStatus> {
        const parameters = new URLSearchParams({
          chainId: request.sourceChainId.toString(),
          protocol: request.protocol,
          txHash: request.sourceTxHash
        })
        const response = await fetcher(`${endpoint}?${parameters}`, {
          cache: 'no-store',
          signal: request.signal
        })
        if (response.status === 429) {
          await waiter(pollIntervalMs, request.signal)
          return poll(attempt + 1)
        }
        const payload: unknown = await response.json()
        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : `Unable to check Enso bridge status (${response.status})`
          throw new Error(message)
        }

        const status = normalizeEnsoBridgeStatus(payload, request)
        onStatus?.(status)
        if (status.status === 'delivered') return status
        if (status.status === 'failed') throw new Error(status.error ?? 'Enso bridge execution failed')
        if (options.maxAttempts !== undefined && attempt >= options.maxAttempts) {
          throw new Error('Enso bridge status polling timed out')
        }
        await waiter(pollIntervalMs, request.signal)
        return poll(attempt + 1)
      }

      return poll(1)
    }
  }
}
