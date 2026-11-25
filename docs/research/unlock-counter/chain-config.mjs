import { createPublicClient, http } from 'viem'
import { arbitrum, base, fantom, katana, mainnet, optimism, polygon } from 'viem/chains'

export const chainId = Number(process.env.PILOT_CHAIN_ID || 1)
export const chain = [mainnet, optimism, polygon, fantom, base, arbitrum, katana].find((item) => item.id === chainId)
if (!chain) throw new Error(`Unsupported pilot chain ${chainId}`)
export const priceNamespace = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  250: 'fantom',
  8453: 'base',
  42161: 'arbitrum',
  747474: 'katana'
}[chainId]
export const client = createPublicClient({
  chain,
  transport: http(
    process.env.PILOT_RPC_URL ||
      (chainId === 1 ? process.env.ETHEREUM_RPC_URL : null) ||
      process.env[`NEXT_PUBLIC_RPC_URI_FOR_${chainId}`] ||
      chain.rpcUrls.default.http[0],
    { timeout: 45000, retryCount: 2 }
  )
})
