export type TExternalToken = {
  address: string
  chainId: number
  protocol: string
  underlyingSymbol: string
  underlyingAddress: string
}

export const EXTERNAL_TOKENS: TExternalToken[] = [
  // Aave V3 (Ethereum)
  {
    address: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
    chainId: 1,
    protocol: 'Aave V3',

    underlyingSymbol: 'USDC',
    underlyingAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  {
    address: '0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8',
    chainId: 1,
    protocol: 'Aave V3',

    underlyingSymbol: 'WETH',
    underlyingAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  {
    address: '0x018008bfb33d285247A21d44E50697654f754e63',
    chainId: 1,
    protocol: 'Aave V3',

    underlyingSymbol: 'DAI',
    underlyingAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  {
    address: '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a',
    chainId: 1,
    protocol: 'Aave V3',

    underlyingSymbol: 'USDT',
    underlyingAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  },
  {
    address: '0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8',
    chainId: 1,
    protocol: 'Aave V3',

    underlyingSymbol: 'WBTC',
    underlyingAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  // Compound V3 (Ethereum)
  {
    address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
    chainId: 1,
    protocol: 'Compound V3',

    underlyingSymbol: 'USDC',
    underlyingAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  {
    address: '0xA17581A9E3356d9A858b789D68B4d866e593aE94',
    chainId: 1,
    protocol: 'Compound V3',

    underlyingSymbol: 'WETH',
    underlyingAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  // Spark (Ethereum)
  {
    address: '0x83F20F44975D03b1b09e64809B757c47f942BEeA',
    chainId: 1,
    protocol: 'Spark',

    underlyingSymbol: 'DAI',
    underlyingAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  {
    address: '0xC7B5EB38B554dEc4F1fB31bfbe08D81A4Ff09EaE',
    chainId: 1,
    protocol: 'Spark',

    underlyingSymbol: 'DAI',
    underlyingAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  // Morpho (Ethereum) - key vault receipt tokens
  {
    address: '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB',
    chainId: 1,
    protocol: 'Morpho',

    underlyingSymbol: 'USDC',
    underlyingAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  {
    address: '0x78Fc2c2eD71dAb0491d268d1a40B6d6f44b2BeC8',
    chainId: 1,
    protocol: 'Morpho',

    underlyingSymbol: 'WETH',
    underlyingAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  {
    address: '0x2371e134e3455e0593363cBF89d3b6cf53740618',
    chainId: 1,
    protocol: 'Morpho',

    underlyingSymbol: 'DAI',
    underlyingAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  {
    address: '0x8CB3649114051E4C8F3816Ef3f980cD1635Aba27',
    chainId: 1,
    protocol: 'Morpho',

    underlyingSymbol: 'USDT',
    underlyingAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  },
  {
    address: '0xd63070114470f685b75B74D60EEc7c1113d33a3D',
    chainId: 1,
    protocol: 'Morpho',

    underlyingSymbol: 'WETH',
    underlyingAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  {
    address: '0x4881Ef0BF6d2365D3dd6499ccd7532bcdBcE0658',
    chainId: 1,
    protocol: 'Morpho',

    underlyingSymbol: 'USDC',
    underlyingAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  // Aave V3 (Arbitrum)
  {
    address: '0x724dc807b04555b71ed48a6896b6F41593b8C637',
    chainId: 42161,
    protocol: 'Aave V3',

    underlyingSymbol: 'USDC',
    underlyingAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
  },
  {
    address: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8',
    chainId: 42161,
    protocol: 'Aave V3',

    underlyingSymbol: 'WETH',
    underlyingAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  },
  // Aave V3 (Base)
  {
    address: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB',
    chainId: 8453,
    protocol: 'Aave V3',

    underlyingSymbol: 'USDC',
    underlyingAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  },
  {
    address: '0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7',
    chainId: 8453,
    protocol: 'Aave V3',

    underlyingSymbol: 'WETH',
    underlyingAddress: '0x4200000000000000000000000000000000000006'
  },
  // Aave V3 (Optimism)
  {
    address: '0x38d693cE1dF5AaDF7bC62043e37bC30b0B186AF',
    chainId: 10,
    protocol: 'Aave V3',

    underlyingSymbol: 'USDC',
    underlyingAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
  },
  // Aave V3 (Polygon)
  {
    address: '0xA4D94019934D8333Ef880ABFFbF2FDd611C0b352',
    chainId: 137,
    protocol: 'Aave V3',

    underlyingSymbol: 'USDC',
    underlyingAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
  },
  {
    address: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8',
    chainId: 137,
    protocol: 'Aave V3',

    underlyingSymbol: 'WETH',
    underlyingAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
  }
]

export const EXTERNAL_TOKEN_LOOKUP = new Map<string, TExternalToken>(
  EXTERNAL_TOKENS.map((token) => [`${token.chainId}:${token.address.toLowerCase()}`, token])
)
