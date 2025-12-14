import type { Address } from 'viem'

export const TEST_VAULT = {
  chainId: 137, // Polygon
  // USDC Vault on Polygon - replace with actual vault address
  vaultAddress: '0x0000000000000000000000000000000000000000' as Address,
  // USDC token on Polygon
  assetAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Address,
  assetSymbol: 'USDC',
  assetDecimals: 6,
  // DAI token for Enso zap tests
  zapToken: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' as Address,
  zapSymbol: 'DAI',
  zapDecimals: 18
} as const

// TODO: Update vaultAddress with actual USDC vault on Polygon
// Find via: https://api.yexporter.io/v1/chains/137/vaults/all
