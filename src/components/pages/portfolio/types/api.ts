import { z } from 'zod'

export const portfolioHistoryVaultSchema = z.object({
  address: z.string(),
  shares: z.string(),
  usdValue: z.number()
})

export const portfolioHistoryChainSchema = z.object({
  chainId: z.number(),
  chainName: z.string(),
  totalUsdValue: z.number(),
  vaults: z.array(portfolioHistoryVaultSchema)
})

export const portfolioHistoryDataPointSchema = z.object({
  date: z.string(),
  totalUsdValue: z.number(),
  chains: z.array(portfolioHistoryChainSchema)
})

export const portfolioHistoryResponseSchema = z.object({
  address: z.string(),
  periodDays: z.number(),
  dataPoints: z.array(portfolioHistoryDataPointSchema)
})

export const portfolioHistorySimpleDataPointSchema = z.object({
  date: z.string(),
  value: z.number()
})

export const portfolioHistorySimpleResponseSchema = z.object({
  address: z.string(),
  dataPoints: z.array(portfolioHistorySimpleDataPointSchema)
})

export type TPortfolioHistoryResponse = z.infer<typeof portfolioHistoryResponseSchema>
export type TPortfolioHistorySimpleResponse = z.infer<typeof portfolioHistorySimpleResponseSchema>
export type TPortfolioHistoryDataPoint = z.infer<typeof portfolioHistoryDataPointSchema>
export type TPortfolioHistoryChartData = Array<{
  date: string
  totalUsdValue: number
}>
