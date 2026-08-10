import { serialize } from 'wagmi'
import type { z } from 'zod'

type TFetchProps<T> = {
  endpoint: string | null
  schema: z.Schema<T>
}

export type TFetchReturn<T> = Promise<{ data: T | null; error?: Error }>

export class FetcherError extends Error {
  response?: { status: number }
  retryAfterMs?: number
  status?: number
  url?: string

  constructor(message: string, options?: { retryAfterMs?: number; status?: number; url?: string }) {
    super(message)
    this.name = 'FetcherError'
    if (options?.status !== undefined) {
      this.status = options.status
      this.response = { status: options.status }
    }
    if (options?.retryAfterMs !== undefined) {
      this.retryAfterMs = options.retryAfterMs
    }
    if (options?.url) {
      this.url = options.url
    }
  }
}

function getRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get('Retry-After')
  if (!retryAfter) {
    return undefined
  }

  const retryAfterSeconds = Number(retryAfter)
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000
  }

  const retryAt = Date.parse(retryAfter)
  return Number.isFinite(retryAt) ? Math.max(retryAt - Date.now(), 0) : undefined
}

async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 15000, ...fetchOptions } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await globalThis.fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...fetchOptions.headers
      }
    })
    return response
  } finally {
    clearTimeout(id)
  }
}

export async function fetch<T>({ endpoint, schema }: TFetchProps<T>): TFetchReturn<T> {
  if (!endpoint) {
    return { data: null, error: new Error('No endpoint provided') }
  }

  try {
    const response = await fetchWithTimeout(endpoint)
    if (!response.ok) {
      return { data: null, error: new Error(`HTTP error: ${response.status}`) }
    }

    const data = await response.json()

    if (!data) {
      return { data: null, error: new Error('No data') }
    }

    const parsedData = schema.safeParse(data)

    if (!parsedData.success) {
      console.error(endpoint, parsedData.error)
      return { data: null, error: parsedData.error }
    }

    return { data: parsedData.data }
  } catch (error) {
    console.error(endpoint, error)
    if (error instanceof Error) {
      return { data: null, error }
    }
    return { data: null, error: new Error(serialize(error)) }
  }
}

export async function curveFetcher<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url)
  const json = await response.json()
  return json?.data as T
}

export async function baseFetcher<T>(url: string, options?: { timeout?: number }): Promise<T> {
  const response = await fetchWithTimeout(url, { timeout: options?.timeout })
  if (!response.ok) {
    throw new FetcherError(`HTTP error: ${response.status}`, {
      retryAfterMs: getRetryAfterMs(response),
      status: response.status,
      url
    })
  }

  try {
    return (await response.json()) as T
  } catch {
    const status = response.status || 0
    throw new FetcherError('Invalid JSON response', { status, url })
  }
}
