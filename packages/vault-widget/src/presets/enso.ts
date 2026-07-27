import { type Address, isAddressEqual } from 'viem'
import { createEnsoAdapter } from '../headless/adapters'
import { createHttpEnsoQuoteProvider } from '../headless/enso'
import { getPositionSources } from '../headless/positionSources'
import type {
  EnsoQuoteProvider,
  VaultWidgetConfig,
  VaultWidgetToken,
  VaultWidgetTokenReference,
  VaultWidgetTokenSelectorChain
} from '../types'

export const ENSO_NATIVE_TOKEN_ADDRESS: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const ENSO_ROUTER_BY_CHAIN: Readonly<Record<number, Address>> = {
  1: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  10: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  137: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  8453: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  42161: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  747474: '0x3067BDBa0e6628497d527bEF511c22DA8b32cA3F'
}

const chainLogo = (chainId: number): string => `https://assets.yearn.fi/chains/${chainId}/logo.svg`

export const ensoSelectorChains: readonly VaultWidgetTokenSelectorChain[] = [
  { id: 1, name: 'Ethereum', logoURI: chainLogo(1) },
  { id: 10, name: 'Optimism', logoURI: chainLogo(10) },
  { id: 137, name: 'Polygon', logoURI: chainLogo(137) },
  { id: 42161, name: 'Arbitrum', logoURI: chainLogo(42161) },
  { id: 8453, name: 'Base', logoURI: chainLogo(8453) },
  { id: 747474, name: 'Katana', logoURI: chainLogo(747474) }
]

export type WithEnsoRoutesOptions = {
  defaultDepositTokens?: readonly VaultWidgetTokenReference[]
  defaultWithdrawTokens?: readonly VaultWidgetTokenReference[]
  endpoint?: string
  enso?: EnsoQuoteProvider
  routeTokens: readonly VaultWidgetToken[]
  routerByChain?: Readonly<Record<number, Address>>
  selectorChains?: readonly VaultWidgetTokenSelectorChain[]
  slippageBps?: number
}

const MAINNET_USDT_ADDRESS: Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

function withApprovalPolicy(token: VaultWidgetToken): VaultWidgetToken {
  if (token.requiresApprovalReset !== undefined) return token
  return token.chainId === 1 && isAddressEqual(token.address, MAINNET_USDT_ADDRESS)
    ? { ...token, requiresApprovalReset: true }
    : token
}

function uniqueTokens(tokens: readonly VaultWidgetToken[]): readonly VaultWidgetToken[] {
  const tokensById = tokens.map(withApprovalPolicy).reduce<Map<string, VaultWidgetToken>>((result, token) => {
    const key = `${token.chainId}:${token.address.toLowerCase()}`
    const existing = result.get(key)
    result.set(
      key,
      existing
        ? {
            ...token,
            ...existing,
            priceUsd: existing.priceUsd ?? token.priceUsd,
            requiresApprovalReset: existing.requiresApprovalReset ?? token.requiresApprovalReset
          }
        : token
    )
    return result
  }, new Map())
  return Array.from(tokensById.values())
}

export function withEnsoRoutes(config: VaultWidgetConfig, options: WithEnsoRoutesOptions): VaultWidgetConfig {
  const asset = config.depositTokens[0]
  if (!asset) return config

  const routerByChain = options.routerByChain ?? ENSO_ROUTER_BY_CHAIN
  const trustedRouters = Object.fromEntries(
    Object.entries(routerByChain).map(([chainId, router]) => [Number(chainId), [router]])
  )
  const provider =
    options.enso ??
    createHttpEnsoQuoteProvider({
      endpoint: options.endpoint ?? '/api/enso/route',
      maxPriceImpactPercent: 1,
      requirePriceImpact: true,
      trustedRouters
    })
  const positionSources = getPositionSources(config)
  const stakedSource = positionSources.find(({ id }) => id === 'staked')
  const depositAdapters = [
    createEnsoAdapter({
      asset,
      autoStake: stakedSource ? false : undefined,
      destinationChainId: config.chainId,
      modes: ['deposit'],
      positionToken: config.positionToken,
      provider,
      routerByChain,
      readPositionValue: config.readPositionValue,
      slippageBps: options.slippageBps
    }),
    ...(stakedSource
      ? [
          createEnsoAdapter({
            asset,
            autoStake: true,
            destinationChainId: config.chainId,
            modes: ['deposit'] as const,
            positionToken: stakedSource.token,
            provider,
            routerByChain,
            readPositionValue: stakedSource.readValue,
            slippageBps: options.slippageBps
          })
        ]
      : [])
  ]
  const withdrawAdapters = positionSources.map((source) =>
    createEnsoAdapter({
      asset,
      destinationChainId: config.chainId,
      modes: ['withdraw'],
      positionSourceId: source.id,
      positionToken: source.token,
      provider,
      routerByChain,
      slippageBps: options.slippageBps,
      withdrawAmountToPosition: source.readAmount ?? config.readPositionAmount
    })
  )
  const routeTokens = uniqueTokens([...config.depositTokens, ...config.withdrawTokens, ...options.routeTokens])
  const hydratedAsset = routeTokens.find(
    (token) => token.chainId === asset.chainId && isAddressEqual(token.address, asset.address)
  )

  return {
    ...config,
    adapters: [...config.adapters, ...depositAdapters, ...withdrawAdapters],
    depositTokens: routeTokens,
    withdrawTokens: routeTokens,
    solvers: [...new Set([...(config.solvers ?? []), 'enso'])],
    display: {
      ...config.display,
      assetPriceUsd: config.display?.assetPriceUsd ?? hydratedAsset?.priceUsd
    },
    tokenSelector: {
      ...config.tokenSelector,
      chains: options.selectorChains ?? config.tokenSelector?.chains ?? ensoSelectorChains,
      defaultTokens: {
        ...config.tokenSelector?.defaultTokens,
        deposit:
          options.defaultDepositTokens ??
          config.tokenSelector?.defaultTokens?.deposit ??
          config.depositTokens.slice(0, 1),
        withdraw:
          options.defaultWithdrawTokens ??
          config.tokenSelector?.defaultTokens?.withdraw ??
          config.withdrawTokens.slice(0, 1)
      }
    }
  }
}
