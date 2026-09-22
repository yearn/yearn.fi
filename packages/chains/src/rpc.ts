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

export function getAppRpcUrl(app: TAppId, chainId: number, overrides: TRpcOverrides): string {
  const policy = APP_PROFILES[app].find(({ id }) => id === chainId)
  if (!policy) throw new Error(`Chain ${chainId} is not enabled for ${app}`)
  const url = overrides[chainId]?.trim() || policy.rpcDefault || getRegisteredChain(chainId)?.rpcUrls.default.http[0]
  if (!url) throw new Error(`No RPC configured for ${app} chain ${chainId}`)
  return url
}
