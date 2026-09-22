// Server-only settings retain priority; public overrides are an explicit fallback.
export function getServerRpcOverride(chainId: number): string | undefined {
  return (
    process.env[`RPC_URI_FOR_${chainId}`]?.trim() ||
    process.env[`NEXT_PUBLIC_RPC_URI_FOR_${chainId}`]?.trim() ||
    undefined
  )
}
