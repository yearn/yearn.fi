export const RPC_URLS = {
  1: process.env.NEXT_PUBLIC_RPC_ETHEREUM || 'https://ethereum-rpc.publicnode.com',
  8453: process.env.NEXT_PUBLIC_RPC_BASE || 'https://base-rpc.publicnode.com',
  42161: process.env.NEXT_PUBLIC_RPC_ARBITRUM || 'https://arbitrum-one-rpc.publicnode.com',
  10: process.env.NEXT_PUBLIC_RPC_OPTIMISM || 'https://optimism-rpc.publicnode.com',
  137: process.env.NEXT_PUBLIC_RPC_POLYGON || 'https://polygon-bor-rpc.publicnode.com',
  4663: process.env.NEXT_PUBLIC_RPC_ROBINHOOD || 'https://rpc.mainnet.chain.robinhood.com'
}
