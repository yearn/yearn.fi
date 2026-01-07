import { serialize } from 'wagmi'
import type { z } from 'zod'

type TFetchProps<T> = {
  endpoint: string | null
  schema: z.Schema<T>
}

export type TFetchReturn<T> = Promise<{ data: T | null; error?: Error }>

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
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }
  const json = await response.json()
  return json?.data as T
}

export async function baseFetcher<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }
  return response.json() as Promise<T>
}
