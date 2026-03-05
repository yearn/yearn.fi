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
