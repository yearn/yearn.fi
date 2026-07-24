import { type Abi, type Address, isAddressEqual, type PublicClient } from 'viem'
import { createEnsoAdapter, createYBoldAdapter } from '../headless/adapters'
import { createHttpEnsoQuoteProvider } from '../headless/enso'
import type { EnsoQuoteProvider, VaultWidgetConfig, VaultWidgetToken, VaultWidgetTokenSelectorChain } from '../types'

export const BOLD_ADDRESS: Address = '0x6440f144b7e50D6a8439336510312d2F54beB01D'
export const YBOLD_VAULT_ADDRESS: Address = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'
export const YBOLD_POSITION_ADDRESS: Address = '0x23346B04a7f55b8760E5860AA5A77383D63491cD'
export const YBOLD_ZAPPER_ADDRESS: Address = '0xE7099092533A3FB693Bb123cD96B8e53b4d83C58'
export const ENSO_NATIVE_TOKEN_ADDRESS: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const ENSO_ROUTER_BY_CHAIN: Readonly<Record<number, Address>> = {
  1: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  10: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  137: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  8453: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  42161: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  747474: '0x3067BDBa0e6628497d527bEF511c22DA8b32cA3F'
}

const YBOLD_ZAPPER_ABI = [
  {
    type: 'function',
    name: 'previewDeposit',
    stateMutability: 'view',
    inputs: [{ name: '_assets', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'previewRedeem',
    stateMutability: 'view',
    inputs: [{ name: '_shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'zapIn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_assets', type: 'uint256' },
      { name: '_receiver', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'zapOut',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_shares', type: 'uint256' },
      { name: '_receiver', type: 'address' },
      { name: '_maxLoss', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const satisfies Abi

const POSITION_ABI = [
  {
    type: 'function',
    name: 'previewWithdraw',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }]
  }
] as const satisfies Abi

const tokenLogo = (address: Address): string =>
  `https://cdn.jsdelivr.net/gh/SmolDapp/tokenAssets@main/tokens/1/${address.toLowerCase()}/logo-128.png`

const chainLogo = (chainId: number): string => `https://assets.yearn.fi/chains/${chainId}/logo.svg`

export const yBoldSelectorChains: readonly VaultWidgetTokenSelectorChain[] = [
  { id: 1, name: 'Ethereum', logoURI: chainLogo(1) },
  { id: 10, name: 'Optimism', logoURI: chainLogo(10) },
  { id: 137, name: 'Polygon', logoURI: chainLogo(137) },
  { id: 42161, name: 'Arbitrum', logoURI: chainLogo(42161) },
  { id: 8453, name: 'Base', logoURI: chainLogo(8453) },
  { id: 747474, name: 'Katana', logoURI: chainLogo(747474) }
]

export const yBoldAssetToken: VaultWidgetToken = {
  address: BOLD_ADDRESS,
  chainId: 1,
  decimals: 18,
  symbol: 'BOLD',
  name: 'BOLD',
  priceUsd: 1,
  logoURI: tokenLogo(BOLD_ADDRESS)
}

export const yBoldPositionToken: VaultWidgetToken = {
  address: YBOLD_POSITION_ADDRESS,
  chainId: 1,
  decimals: 18,
  symbol: 'ysyBOLD',
  name: 'Staked yBOLD',
  logoURI: `https://assets.yearn.fi/tokens/1/${YBOLD_POSITION_ADDRESS.toLowerCase()}/logo-128.png`
}

export const yBoldVaultToken: VaultWidgetToken = {
  address: YBOLD_VAULT_ADDRESS,
  chainId: 1,
  decimals: 18,
  symbol: 'yBOLD',
  name: 'Yearn BOLD',
  logoURI: `https://assets.yearn.fi/tokens/1/${YBOLD_VAULT_ADDRESS.toLowerCase()}/logo-128.png`
}

const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const yBoldRouteTokens: readonly VaultWidgetToken[] = [
  yBoldAssetToken,
  yBoldVaultToken,
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    priceUsd: 1,
    logoURI: tokenLogo('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    chainId: 1,
    decimals: 6,
    symbol: 'USDT',
    name: 'Tether USD',
    priceUsd: 1,
    logoURI: tokenLogo('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
    requiresApprovalReset: true
  },
  {
    address: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    chainId: 1,
    decimals: 18,
    symbol: 'USDS',
    name: 'USDS Stablecoin',
    priceUsd: 1,
    logoURI: tokenLogo('0xdC035D45d973E3EC169d2276DDab16f1e407384F')
  },
  {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    chainId: 1,
    decimals: 18,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    priceUsd: 1,
    logoURI: tokenLogo('0x6B175474E89094C44Da98b954EedeAC495271d0F')
  },
  {
    address: ENSO_NATIVE_TOKEN_ADDRESS,
    chainId: 1,
    decimals: 18,
    symbol: 'ETH',
    name: 'Ether',
    logoURI: tokenLogo(WETH),
    isNative: true
  },
  {
    address: WETH,
    chainId: 1,
    decimals: 18,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    logoURI: tokenLogo(WETH)
  }
]

export type CreateYBoldPresetOptions = {
  defaultAssetTokens?: readonly VaultWidgetToken[]
  defaultDepositAssetTokens?: readonly VaultWidgetToken[]
  defaultWithdrawAssetTokens?: readonly VaultWidgetToken[]
  enso?: EnsoQuoteProvider
  ensoEndpoint?: string
  routeTokens?: readonly VaultWidgetToken[]
  slippageBps?: number
}

async function readPositionValue(publicClient: PublicClient, shares: bigint): Promise<bigint> {
  return publicClient.readContract({
    address: YBOLD_ZAPPER_ADDRESS,
    abi: YBOLD_ZAPPER_ABI,
    functionName: 'previewRedeem',
    args: [shares]
  })
}

async function withdrawAmountToPosition(publicClient: PublicClient, amount: bigint): Promise<bigint> {
  return publicClient.readContract({
    address: YBOLD_POSITION_ADDRESS,
    abi: POSITION_ABI,
    functionName: 'previewWithdraw',
    args: [amount]
  })
}

export function createYBoldPreset(options: CreateYBoldPresetOptions = {}): VaultWidgetConfig {
  const trustedRouters = Object.fromEntries(
    Object.entries(ENSO_ROUTER_BY_CHAIN).map(([chainId, router]) => [Number(chainId), [router]])
  )
  const provider =
    options.enso ??
    createHttpEnsoQuoteProvider({
      endpoint: options.ensoEndpoint ?? '/api/enso/route',
      maxPriceImpactPercent: 1,
      requirePriceImpact: true,
      trustedRouters
    })
  const tokens = options.routeTokens ?? yBoldRouteTokens
  const getTokensBySymbol = (symbols: readonly string[]): VaultWidgetToken[] =>
    symbols.flatMap((symbol) => tokens.find((token) => token.symbol === symbol) ?? [])
  const defaultDepositAssetTokens =
    options.defaultDepositAssetTokens ??
    options.defaultAssetTokens ??
    getTokensBySymbol(['BOLD', 'USDC', 'USDT', 'DAI', 'WETH'])
  const defaultWithdrawAssetTokens =
    options.defaultWithdrawAssetTokens ??
    options.defaultAssetTokens ??
    getTokensBySymbol(['yBOLD', 'USDC', 'USDT', 'USDS', 'BOLD', 'WETH'])

  return {
    id: 'ybold-mainnet',
    name: 'Yearn BOLD',
    chainId: 1,
    vaultAddress: YBOLD_VAULT_ADDRESS,
    positionToken: yBoldPositionToken,
    depositTokens: tokens,
    withdrawTokens: tokens,
    adapters: [
      createYBoldAdapter({
        asset: yBoldAssetToken,
        positionToken: yBoldPositionToken,
        stakingAbi: POSITION_ABI,
        zapperAbi: YBOLD_ZAPPER_ABI,
        zapperAddress: YBOLD_ZAPPER_ADDRESS
      }),
      createEnsoAdapter({
        asset: yBoldAssetToken,
        destinationChainId: 1,
        positionToken: yBoldPositionToken,
        provider,
        routerByChain: ENSO_ROUTER_BY_CHAIN,
        readPositionValue,
        slippageBps: options.slippageBps,
        withdrawAmountToPosition
      })
    ],
    modes: ['deposit', 'withdraw', 'info'],
    defaultMode: 'deposit',
    defaultDepositToken: BOLD_ADDRESS,
    defaultWithdrawToken: BOLD_ADDRESS,
    defaultSlippagePercent: (options.slippageBps ?? 50) / 100,
    defaultMaxLossBps: 50,
    copy: {
      unstakeAndRedeem: 'You will unstake and redeem'
    },
    tokenSelector: {
      chains: yBoldSelectorChains,
      defaultTokens: {
        deposit: defaultDepositAssetTokens,
        withdraw: defaultWithdrawAssetTokens
      }
    },
    solvers: ['enso'],
    display: {
      approvalSpenderName: {
        deposit: 'yBOLD Zap',
        withdraw: 'Yearn Zap'
      },
      assetPriceUsd: 1,
      estimatedApr: 0,
      positionLabel: 'Staked shares'
    },
    readPositionValue
  }
}

export const yBoldMainnetPreset = createYBoldPreset()

export function isYBoldVault(address: Address): boolean {
  return isAddressEqual(address, YBOLD_VAULT_ADDRESS)
}

export { POSITION_ABI as yBoldPositionAbi, YBOLD_ZAPPER_ABI as yBoldZapperAbi, yBoldRouteTokens }
