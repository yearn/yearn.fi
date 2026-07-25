import { getNetwork, getRpcUriFor } from '@shared/utils/wagmi'
import type { Chain, Transport } from 'viem'
import { mainnet } from 'viem/chains'
import { fallback, http } from 'wagmi'
import { env } from '@/env'
import { type TTenderlyRuntime, tenderlyRuntime } from './tenderly'

function getLegacyRpcUri(chainId: number): string {
  const value = env.NEXT_PUBLIC_JSON_RPC_URI?.[chainId] || env.NEXT_PUBLIC_JSON_RPC_URL?.[chainId]
  return typeof value === 'string' ? value.trim() : ''
}

function isCanonicalMainnetChain(chain: Chain): boolean {
  return chain.id === mainnet.id && chain.rpcUrls.default.http[0] === mainnet.rpcUrls.default.http[0]
}

export function getTransportRpcUrlsForChain(chain: Chain, runtime: TTenderlyRuntime = tenderlyRuntime): string[] {
  const indexedNetwork = isCanonicalMainnetChain(chain) ? undefined : getNetwork(chain.id)
  const tenderlyRpc = runtime.isEnabled ? runtime.configuredByCanonicalId[chain.id]?.rpcUri : undefined

  return [
    ...new Set(
      [
        tenderlyRpc,
        indexedNetwork?.defaultRPC,
        getRpcUriFor(chain.id),
        getLegacyRpcUri(chain.id),
        chain.rpcUrls.default.http[0],
        chain.rpcUrls.public?.http?.[0]
      ].filter((value): value is string => Boolean(value))
    )
  ]
}

export function buildTransports(chains: readonly Chain[]): Record<number, Transport> {
  const transports: Record<number, Transport> = {}

  for (const chain of chains) {
    const availableTransports = getTransportRpcUrlsForChain(chain, tenderlyRuntime).map((rpcUrl) =>
      http(rpcUrl, { batch: true })
    )
    availableTransports.push(http())
    transports[chain.id] = fallback(availableTransports)
  }

  return transports
}
