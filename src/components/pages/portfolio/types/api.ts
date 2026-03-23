import { z } from 'zod'

const portfolioHistorySimpleDataPointSchema = z.object({
  date: z.string(),
  value: z.number()
})

export const portfolioHistorySimpleResponseSchema = z.object({
  address: z.string(),
  dataPoints: z.array(portfolioHistorySimpleDataPointSchema)
})

const portfolioPnlSummarySchema = z.object({
  totalVaults: z.number(),
  partialVaults: z.number(),
  totalWindfallPnlUsd: z.number(),
  totalPnlUsd: z.number(),
  totalEconomicGainUsd: z.number(),
  isComplete: z.boolean()
})

export const portfolioPnlResponseSchema = z.object({
  address: z.string(),
  summary: portfolioPnlSummarySchema
})

export type TPortfolioHistorySimpleResponse = z.infer<typeof portfolioHistorySimpleResponseSchema>
export type TPortfolioPnlResponse = z.infer<typeof portfolioPnlResponseSchema>
export type TPortfolioPnlSummary = z.infer<typeof portfolioPnlSummarySchema>
export type TPortfolioHistoryChartData = Array<{
  date: string
  totalUsdValue: number
}>
