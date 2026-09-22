import { APP_PROFILES, type TAppId } from '@yearn/chains/profiles'
import { getRegisteredChain } from '@yearn/chains/selectors'

export type TRpcOverrides = Readonly<Partial<Record<number, string>>>

export function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

// Pure parser: no process.env access, so server secrets cannot enter client configuration implicitly.
export function parseRpcOverrides(raw: string | undefined): TRpcOverrides {
  if (!raw?.trim()) return {}
  const value: unknown = (() => {
    try {
      return JSON.parse(raw)
    } catch {
      throw new Error('NEXT_PUBLIC_CHAIN_RPC_URLS must be a JSON object')
    }
  })()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('NEXT_PUBLIC_CHAIN_RPC_URLS must be a JSON object')
  }
  return Object.fromEntries(
    Object.entries(value).map(([id, url]) => {
      if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !getRegisteredChain(Number(id))) {
        throw new Error(`NEXT_PUBLIC_CHAIN_RPC_URLS contains an unregistered chain ID: ${id}`)
      }
      if (typeof url !== 'string' || !isHttpUrl(url.trim())) {
        throw new Error(`NEXT_PUBLIC_CHAIN_RPC_URLS requires an HTTP(S) URL for chain ${id}`)
      }
      return [Number(id), url.trim()]
    })
  )
}

// Explicit map overrides legacy settings. Tenderly execution overrides must be applied by the host first.
export const getRpcOverride = (chainId: number, overrides: TRpcOverrides, legacy?: string) =>
  overrides[chainId] || legacy?.trim() || undefined

export function getAppRpcUrl(app: TAppId, chainId: number, overrides: TRpcOverrides, legacy?: string): string {
  const policy = APP_PROFILES[app].find(({ id }) => id === chainId)
  if (!policy) throw new Error(`Chain ${chainId} is not enabled for ${app}`)
  const url =
    getRpcOverride(chainId, overrides, legacy) ||
    policy.rpcDefault ||
    getRegisteredChain(chainId)?.rpcUrls.default.http[0]
  if (!url) throw new Error(`No RPC configured for ${app} chain ${chainId}`)
  return url
}
