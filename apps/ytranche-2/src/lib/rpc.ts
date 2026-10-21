const PUBLIC_ETHEREUM_RPC_URLS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth-mainnet.public.blastapi.io',
  'https://1rpc.io/eth'
] as const

function validHttpUrl(value: string | undefined): string | null {
  const candidate = value?.trim()
  if (!candidate) return null

  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

const configuredEthereumRpcUrl = validHttpUrl(process.env.NEXT_PUBLIC_RPC_URI_FOR_1)

export const ETHEREUM_RPC_URLS = Array.from(
  new Set([...(configuredEthereumRpcUrl ? [configuredEthereumRpcUrl] : []), ...PUBLIC_ETHEREUM_RPC_URLS])
)
