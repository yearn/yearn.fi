import type { Address } from 'viem'

export const TEST_VAULT = {
  chainId: 137, // Polygon
  // USDC Vault on Polygon - replace with actual vault address
  vaultAddress: '0x34b9421Fe3d52191B64bC32ec1aB764dcBcDbF5e' as Address,
  // USDC token on Polygon
  assetAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address,
  assetSymbol: 'USDC',
  assetDecimals: 6,
  // DAI token for Enso zap tests
  zapToken: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' as Address,
  zapSymbol: 'DAI',
  zapDecimals: 18
} as const
