import { z } from 'zod'

const portfolioHistorySimpleDataPointSchema = z.object({
  date: z.string(),
  value: z.number()
})

const portfolioProtocolReturnHistoryDataPointSchema = z.object({
  date: z.string(),
  growthWeightUsd: z.number(),
  protocolReturnPct: z.number().nullable()
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

const portfolioPnlCategoryBreakdownSchema = z.object({
  totalPnlUsd: z.number(),
  totalEconomicGainUsd: z.number()
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
  dataPoints: z.array(portfolioProtocolReturnHistoryDataPointSchema)
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

const portfolioPnlSummarySchema = z.object({
  totalVaults: z.number(),
  partialVaults: z.number(),
  totalWindfallPnlUsd: z.number(),
  totalPnlUsd: z.number(),
  totalEconomicGainUsd: z.number(),
  byCategory: z.object({
    stable: portfolioPnlCategoryBreakdownSchema,
    volatile: portfolioPnlCategoryBreakdownSchema
  }),
  isComplete: z.boolean()
})

const portfolioProtocolReturnSummarySchema = z.object({
  totalVaults: z.number(),
  completeVaults: z.number(),
  partialVaults: z.number(),
  baselineWeightUsd: z.number(),
  baselineExposureWeightUsdYears: z.number(),
  growthWeightUsd: z.number(),
  realizedGrowthWeightUsd: z.number(),
  unrealizedGrowthWeightUsd: z.number(),
  protocolReturnPct: z.number().nullable(),
  annualizedProtocolReturnPct: z.number().nullable(),
  isComplete: z.boolean()
})

const portfolioProtocolReturnVaultSchema = z.object({
  chainId: z.number(),
  vaultAddress: z.string(),
  status: z.enum(['ok', 'missing_metadata', 'missing_pps', 'missing_receipt_price', 'partial']),
  issues: z.array(z.enum(['missing_metadata', 'missing_pps', 'missing_receipt_price', 'unmatched_exit'])),
  metadata: z.object({
    symbol: z.string().nullable(),
    decimals: z.number(),
    assetDecimals: z.number(),
    tokenAddress: z.string().nullable()
  })
})

export const portfolioPnlResponseSchema = z.object({
  address: z.string(),
  summary: portfolioPnlSummarySchema
})

export const portfolioProtocolReturnResponseSchema = z.object({
  address: z.string(),
  summary: portfolioProtocolReturnSummarySchema,
  vaults: z.array(portfolioProtocolReturnVaultSchema)
})

export type TPortfolioHistorySimpleResponse = z.infer<typeof portfolioHistorySimpleResponseSchema>
export type TPortfolioProtocolReturnHistoryResponse = z.infer<typeof portfolioProtocolReturnHistoryResponseSchema>
export type TPortfolioBreakdownResponse = z.infer<typeof portfolioBreakdownResponseSchema>
export type TPortfolioBreakdownVault = z.infer<typeof portfolioBreakdownVaultSchema>
export type TPortfolioPnlResponse = z.infer<typeof portfolioPnlResponseSchema>
export type TPortfolioPnlSummary = z.infer<typeof portfolioPnlSummarySchema>
export type TPortfolioProtocolReturnResponse = z.infer<typeof portfolioProtocolReturnResponseSchema>
export type TPortfolioProtocolReturnSummary = z.infer<typeof portfolioProtocolReturnSummarySchema>
export type TPortfolioProtocolReturnVault = z.infer<typeof portfolioProtocolReturnVaultSchema>
export type TPortfolioHistoryDenomination = z.infer<typeof portfolioHistorySimpleResponseSchema>['denomination']
export type TPortfolioHistoryTimeframe = z.infer<typeof portfolioHistorySimpleResponseSchema>['timeframe']
export type TPortfolioHistoryChartData = Array<{
  date: string
  value: number
}>
export type TPortfolioProtocolReturnHistoryChartData = Array<{
  date: string
  growthWeightUsd: number
  protocolReturnPct: number | null
}>
