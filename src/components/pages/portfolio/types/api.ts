import { z } from 'zod'

const portfolioHistorySimpleDataPointSchema = z.object({
  date: z.string(),
  value: z.number()
})

export const portfolioHistorySimpleResponseSchema = z.object({
  address: z.string(),
  dataPoints: z.array(portfolioHistorySimpleDataPointSchema)
})

export type TPortfolioHistorySimpleResponse = z.infer<typeof portfolioHistorySimpleResponseSchema>
export type TPortfolioHistoryChartData = Array<{
  date: string
  totalUsdValue: number
}>

// PnL API types
const pnlSummarySchema = z.object({
  totalDepositedUsd: z.number(),
  totalWithdrawnUsd: z.number(),
  currentValueUsd: z.number(),
  realizedPnLUsd: z.number(),
  unrealizedPnLUsd: z.number(),
  totalPnLUsd: z.number(),
  totalPnLPercent: z.number()
})

export const portfolioPnLResponseSchema = z.object({
  address: z.string(),
  summary: pnlSummarySchema,
  vaults: z.array(z.unknown()) // We only need summary for the header
})

export type TPortfolioPnLResponse = z.infer<typeof portfolioPnLResponseSchema>
export type TPortfolioPnLSummary = z.infer<typeof pnlSummarySchema>
