import { z } from 'zod'

const portfolioHistorySimpleDataPointSchema = z.object({
  date: z.string(),
  value: z.number()
})

const portfolioProtocolReturnHistoryDataPointSchema = z.object({
  date: z.string(),
  growthWeightUsd: z.number(),
  growthWeightEth: z.number().nullable(),
  protocolReturnPct: z.number().nullable(),
  annualizedProtocolReturnPct: z.number().nullable(),
  growthIndex: z.number().nullable()
})

const portfolioProtocolReturnHistorySummarySchema = z.object({
  totalVaults: z.number(),
  completeVaults: z.number(),
  partialVaults: z.number(),
  recommendedGrowthDisplay: z.enum(['usd', 'eth', 'index']),
  recommendedGrowthDisplayReason: z.enum(['stable_dominant', 'eth_dominant', 'mixed']),
  openBaselineCompositionUsd: z.object({
    stable: z.number(),
    ethFamily: z.number(),
    other: z.number()
  }),
  isComplete: z.boolean()
})

const portfolioProtocolReturnHistoryFamilyPointSchema = z.object({
  date: z.string(),
  timestamp: z.number(),
  protocolReturnPct: z.number().nullable(),
  growthWeightUsd: z.number().nullable(),
  growthIndex: z.number().nullable()
})

const portfolioProtocolReturnHistoryFamilySeriesSchema = z.object({
  chainId: z.number(),
  vaultAddress: z.string(),
  symbol: z.string().nullable(),
  status: z.enum(['ok', 'missing_metadata', 'missing_pps', 'missing_receipt_price', 'partial']),
  dataPoints: z.array(portfolioProtocolReturnHistoryFamilyPointSchema)
})

const portfolioBreakdownVaultSchema = z.object({
  chainId: z.number(),
  vaultAddress: z.string(),
  shares: z.string(),
  sharesFormatted: z.number(),
  pricePerShare: z.number().nullable(),
  tokenPrice: z.number().nullable(),
  usdValue: z.number().nullable(),
  metadata: z
    .object({
      symbol: z.string(),
      decimals: z.number(),
      tokenAddress: z.string()
    })
    .nullable(),
  status: z.enum(['ok', 'missing_metadata', 'missing_pps', 'missing_price'])
})

export const portfolioHistorySimpleResponseSchema = z.object({
  address: z.string(),
  denomination: z.enum(['usd', 'eth']).optional().default('usd'),
  timeframe: z.enum(['1y', 'all']).optional().default('1y'),
  dataPoints: z.array(portfolioHistorySimpleDataPointSchema)
})

export const portfolioProtocolReturnHistoryResponseSchema = z.object({
  address: z.string(),
  timeframe: z.enum(['1y', 'all']).optional().default('1y'),
  summary: portfolioProtocolReturnHistorySummarySchema,
  dataPoints: z.array(portfolioProtocolReturnHistoryDataPointSchema),
  familySeries: z.array(portfolioProtocolReturnHistoryFamilySeriesSchema).optional().default([])
})

export const portfolioHistoryProgressResponseSchema = z.object({
  id: z.string(),
  route: z.string(),
  addressHash: z.string(),
  status: z.enum(['running', 'complete', 'error']),
  progress: z.number(),
  message: z.string(),
  detail: z.string().nullable(),
  startedAt: z.number(),
  updatedAt: z.number(),
  logs: z
    .array(
      z.object({
        elapsedMs: z.number(),
        scope: z.string(),
        message: z.string(),
        payload: z.record(z.string(), z.unknown()).optional()
      })
    )
    .optional()
    .default([])
})

export const portfolioBreakdownResponseSchema = z.object({
  address: z.string(),
  version: z.string(),
  date: z.string(),
  timestamp: z.number(),
  summary: z.object({
    totalVaults: z.number(),
    vaultsWithShares: z.number(),
    totalUsdValue: z.number(),
    missingMetadata: z.number(),
    missingPps: z.number(),
    missingPrice: z.number()
  }),
  vaults: z.array(portfolioBreakdownVaultSchema),
  issues: z.object({
    missingMetadata: z.array(z.string()),
    missingPps: z.array(z.string()),
    missingPrice: z.array(z.string())
  }),
  message: z.string().optional()
})

const portfolioActivityEntrySchema = z.object({
  chainId: z.number(),
  txHash: z.string(),
  timestamp: z.number(),
  action: z.enum(['deposit', 'withdraw', 'stake', 'unstake']),
  vaultAddress: z.string(),
  familyVaultAddress: z.string(),
  assetSymbol: z.string().nullable(),
  assetAmount: z.string(),
  assetAmountFormatted: z.number().nullable(),
  shareAmount: z.string(),
  shareAmountFormatted: z.number().nullable(),
  status: z.enum(['ok', 'missing_metadata'])
})

export const portfolioActivityResponseSchema = z.object({
  address: z.string(),
  version: z.enum(['all', 'v2', 'v3']).optional().default('all'),
  limit: z.number(),
  offset: z.number(),
  pageInfo: z.object({
    hasMore: z.boolean(),
    nextOffset: z.number().nullable()
  }),
  entries: z.array(portfolioActivityEntrySchema)
})

export type TPortfolioHistorySimpleResponse = z.infer<typeof portfolioHistorySimpleResponseSchema>
export type TPortfolioProtocolReturnHistoryResponse = z.infer<typeof portfolioProtocolReturnHistoryResponseSchema>
export type TPortfolioHistoryProgressResponse = z.infer<typeof portfolioHistoryProgressResponseSchema>
export type TPortfolioProtocolReturnHistorySummary = z.infer<typeof portfolioProtocolReturnHistorySummarySchema>
export type TPortfolioBreakdownResponse = z.infer<typeof portfolioBreakdownResponseSchema>
export type TPortfolioBreakdownVault = z.infer<typeof portfolioBreakdownVaultSchema>
export type TPortfolioActivityResponse = z.infer<typeof portfolioActivityResponseSchema>
export type TPortfolioActivityEntry = z.infer<typeof portfolioActivityEntrySchema>
export type TPortfolioHistoryDenomination = z.infer<typeof portfolioHistorySimpleResponseSchema>['denomination']
export type TPortfolioHistoryTimeframe = z.infer<typeof portfolioHistorySimpleResponseSchema>['timeframe']
export type TPortfolioHistoryChartData = Array<{
  date: string
  value: number
}>
export type TPortfolioProtocolReturnHistoryChartData = Array<{
  date: string
  growthWeightUsd: number
  growthWeightEth: number | null
  protocolReturnPct: number | null
  annualizedProtocolReturnPct: number | null
  growthIndex: number | null
}>
export type TPortfolioProtocolReturnHistoryFamilySeries = Array<{
  chainId: number
  vaultAddress: string
  symbol: string | null
  status: 'ok' | 'missing_metadata' | 'missing_pps' | 'missing_receipt_price' | 'partial'
  dataPoints: Array<{
    date: string
    timestamp: number
    protocolReturnPct: number | null
    growthWeightUsd: number | null
    growthIndex: number | null
  }>
}>
