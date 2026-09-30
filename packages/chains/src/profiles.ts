import type { Address } from 'viem'

export type TAppId = 'yearn' | 'erc4626' | 'ybold'
export type TChainPolicy = {
  id: number
  rpcDefault?: string
  vaults?: readonly ('v2' | 'v3')[]
  vaultOrder?: number
  v3Filter?: 'primary' | 'secondary'
  history?: boolean
  nativeBalance?: boolean
  rpcBalanceFallback?: boolean
  ensoOrder?: number
  depositTokens?: readonly Address[]
  withdrawTokens?: readonly Address[]
}

export const YEARN_PROFILE: readonly TChainPolicy[] = [
  {
    id: 1,
    vaults: ['v2', 'v3'],
    vaultOrder: 0,
    v3Filter: 'primary',
    history: true,
    nativeBalance: true,
    ensoOrder: 0,
    depositTokens: [
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0xdC035D45d973E3EC169d2276DDab16f1e407384F', // USDS
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' // WBTC
    ],
    withdrawTokens: [
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0xdC035D45d973E3EC169d2276DDab16f1e407384F', // USDS
      '0x6440f144b7e50D6a8439336510312d2F54beB01D', // BOLD
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' // WBTC
    ]
  },
  {
    id: 10,
    vaults: ['v2'],
    vaultOrder: 3,
    history: true,
    nativeBalance: true,
    ensoOrder: 1,
    depositTokens: [
      '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
      '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
      '0x4F13a96EC5C4Cf34e442b46Bbd98a0791F20edC3', // USDS
      '0x4200000000000000000000000000000000000006' // WETH
    ],
    withdrawTokens: [
      '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
      '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
      '0x4F13a96EC5C4Cf34e442b46Bbd98a0791F20edC3', // USDS
      '0x4200000000000000000000000000000000000006' // WETH
    ]
  },
  {
    id: 137,
    history: true,
    nativeBalance: true,
    ensoOrder: 2,
    depositTokens: [
      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
      '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
      '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // WMATIC
    ],
    withdrawTokens: [
      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
      '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
      '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // WMATIC
    ]
  },
  { id: 250, history: true, nativeBalance: true, rpcBalanceFallback: true },
  {
    id: 8453,
    vaults: ['v2', 'v3'],
    vaultOrder: 2,
    v3Filter: 'secondary',
    history: true,
    nativeBalance: true,
    ensoOrder: 4,
    depositTokens: [
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      '0x4200000000000000000000000000000000000006', // WETH
      '0x820C137fa70C8691f0e44Dc420a5e53c168921Dc', // USDS
      '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' // cbBTC
    ],
    withdrawTokens: [
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      '0x820C137fa70C8691f0e44Dc420a5e53c168921Dc', // USDS
      '0x4200000000000000000000000000000000000006', // WETH
      '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' // cbBTC
    ]
  },
  {
    id: 42161,
    history: true,
    nativeBalance: true,
    ensoOrder: 3,
    depositTokens: [
      '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
      '0x6491c05A82219b8D1479057361ff1654749b876b', // USDS
      '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // WETH
    ],
    withdrawTokens: [
      '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
      '0x6491c05A82219b8D1479057361ff1654749b876b', // USDS
      '0x4ecf61a6c2FaB8A047CEB3B3B263B401763e9D49', // USND
      '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // WETH
    ]
  },
  { id: 146 },
  {
    id: 747474,
    vaults: ['v3'],
    vaultOrder: 1,
    v3Filter: 'primary',
    history: true,
    nativeBalance: true,
    ensoOrder: 5,
    depositTokens: [
      '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36', // vbUSDC
      '0x2DCa96907fde857dd3D816880A0df407eeB2D2F2', // vbUSDT
      '0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62', // vbETH
      '0x00000000efe302beaa2b3e6e1b18d08d69a9012a' // AUSD
    ],
    withdrawTokens: [
      '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36', // vbUSDC
      '0x2DCa96907fde857dd3D816880A0df407eeB2D2F2', // vbUSDT
      '0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62', // vbETH
      '0x00000000efe302beaa2b3e6e1b18d08d69a9012a' // AUSD
    ]
  },
  {
    id: 4663,
    vaults: ['v3'],
    vaultOrder: 4,
    history: true,
    nativeBalance: true,
    ensoOrder: 6,
    depositTokens: [
      '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', // USDG
      '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' // WETH
    ],
    withdrawTokens: [
      '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', // USDG
      '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' // WETH
    ]
  }
]

export const APP_PROFILES: Record<TAppId, readonly TChainPolicy[]> = {
  yearn: YEARN_PROFILE,
  erc4626: [
    { id: 1, rpcDefault: 'https://ethereum-rpc.publicnode.com' },
    { id: 8453, rpcDefault: 'https://base-rpc.publicnode.com' },
    { id: 42161, rpcDefault: 'https://arbitrum-one-rpc.publicnode.com' },
    { id: 10, rpcDefault: 'https://optimism-rpc.publicnode.com' },
    { id: 137, rpcDefault: 'https://polygon-bor-rpc.publicnode.com' },
    { id: 4663, rpcDefault: 'https://rpc.mainnet.chain.robinhood.com' }
  ],
  ybold: [{ id: 1, rpcDefault: 'https://ethereum-rpc.publicnode.com' }]
}
