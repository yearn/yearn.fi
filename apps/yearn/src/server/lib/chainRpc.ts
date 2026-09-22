import { getRpcOverride, parseRpcOverrides } from '@yearn/chains'

// Server-only settings retain priority; public overrides are an explicit fallback.
export function getServerRpcOverride(chainId: number): string | undefined {
  return (
    process.env[`RPC_URI_FOR_${chainId}`]?.trim() ||
    getRpcOverride(
      chainId,
      parseRpcOverrides(process.env.NEXT_PUBLIC_CHAIN_RPC_URLS),
      process.env[`NEXT_PUBLIC_RPC_URI_FOR_${chainId}`]
    )
  )
}
