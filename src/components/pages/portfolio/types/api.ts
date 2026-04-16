import { z } from 'zod'

const portfolioHistorySimpleDataPointSchema = z.object({
  date: z.string(),
  value: z.number()
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
  dataPoints: z.array(portfolioHistorySimpleDataPointSchema)
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

export const portfolioPnlResponseSchema = z.object({
  address: z.string(),
  summary: portfolioPnlSummarySchema
})

export const portfolioProtocolReturnResponseSchema = z.object({
  address: z.string(),
  summary: portfolioProtocolReturnSummarySchema
})

export type TPortfolioHistorySimpleResponse = z.infer<typeof portfolioHistorySimpleResponseSchema>
export type TPortfolioBreakdownResponse = z.infer<typeof portfolioBreakdownResponseSchema>
export type TPortfolioBreakdownVault = z.infer<typeof portfolioBreakdownVaultSchema>
export type TPortfolioPnlResponse = z.infer<typeof portfolioPnlResponseSchema>
export type TPortfolioPnlSummary = z.infer<typeof portfolioPnlSummarySchema>
export type TPortfolioProtocolReturnResponse = z.infer<typeof portfolioProtocolReturnResponseSchema>
export type TPortfolioProtocolReturnSummary = z.infer<typeof portfolioProtocolReturnSummarySchema>
export type TPortfolioHistoryDenomination = z.infer<typeof portfolioHistorySimpleResponseSchema>['denomination']
export type TPortfolioHistoryChartData = Array<{
  date: string
  value: number
}>
