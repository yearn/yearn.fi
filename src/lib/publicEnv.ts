import type { TDict } from '@shared/types'

const PUBLIC_RPC_URIS = {
  '1': process.env.NEXT_PUBLIC_RPC_URI_FOR_1,
  '10': process.env.NEXT_PUBLIC_RPC_URI_FOR_10,
  '100': process.env.NEXT_PUBLIC_RPC_URI_FOR_100,
  '137': process.env.NEXT_PUBLIC_RPC_URI_FOR_137,
  '146': process.env.NEXT_PUBLIC_RPC_URI_FOR_146,
  '250': process.env.NEXT_PUBLIC_RPC_URI_FOR_250,
  '8453': process.env.NEXT_PUBLIC_RPC_URI_FOR_8453,
  '42161': process.env.NEXT_PUBLIC_RPC_URI_FOR_42161,
  '747474': process.env.NEXT_PUBLIC_RPC_URI_FOR_747474
} as const

const LEGACY_RPC_URI_MAP = parseJsonEnv<TDict<string>>(process.env.NEXT_PUBLIC_JSON_RPC_URI)
const LEGACY_RPC_URL_MAP = parseJsonEnv<TDict<string>>(process.env.NEXT_PUBLIC_JSON_RPC_URL)
const KNOWN_ENS_MAP = parseJsonEnv<TDict<string>>(process.env.NEXT_PUBLIC_KNOWN_ENS) || {}

function trimToUndefined(value?: string): string | undefined {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : undefined
}

function parseJsonEnv<T>(value?: string): T | undefined {
  const normalizedValue = trimToUndefined(value)

  if (!normalizedValue) {
    return undefined
  }

  try {
    return JSON.parse(normalizedValue) as T
  } catch (error) {
    console.error('Failed to parse public env JSON value', error)
    return undefined
  }
}

function getLegacyRpcMapValue(value: unknown, chainId: string): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const rpcValue = (value as Record<string, unknown>)[chainId]
  return typeof rpcValue === 'string' ? rpcValue.trim() : ''
}

export function getPublicRpcUriFor(chainId: number | string): string {
  const key = String(chainId) as keyof typeof PUBLIC_RPC_URIS
  return trimToUndefined(PUBLIC_RPC_URIS[key]) || ''
}

export function getLegacyRpcUriFor(chainId: number | string): string {
  const normalizedChainId = String(chainId)

  return getLegacyRpcMapValue(LEGACY_RPC_URI_MAP, normalizedChainId) || getLegacyRpcMapValue(LEGACY_RPC_URL_MAP, normalizedChainId)
}

export function getKnownEnsMap(): TDict<string> {
  return KNOWN_ENS_MAP
}
