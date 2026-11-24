import { z } from 'zod'

const coverage = z.enum(['complete', 'partial', 'unavailable'])

export type TWalletHistoryCoverage = z.infer<typeof coverage>

export const coveredHoldingsHistorySchema = z.object({
  address: z.string(),
  denomination: z.enum(['usd', 'eth']),
  timeframe: z.enum(['1y', 'all']),
  dataPoints: z
    .array(
      z.object({
        date: z.string(),
        value: z.number().nullable(),
        coverage
      })
    )
    .min(1)
})

export type TCoveredHoldingsHistory = z.infer<typeof coveredHoldingsHistorySchema>
