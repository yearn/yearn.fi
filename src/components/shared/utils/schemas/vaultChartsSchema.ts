import { z } from 'zod'

export const vaultTimeseriesPointSchema = z.object({
  chainId: z.number(),
  address: z.string(),
  label: z.string(),
  component: z.string().optional().nullable(),
  period: z.string(),
  time: z.union([z.string(), z.number()]),
  value: z.number().nullable()
})

export const vaultChartTimeseriesSchema = z.object({
  apyWeekly: z.array(vaultTimeseriesPointSchema),
  apyMonthly: z.array(vaultTimeseriesPointSchema),
  tvl: z.array(vaultTimeseriesPointSchema),
  pps: z.array(vaultTimeseriesPointSchema)
})

export type TVaultTimeseriesPoint = z.infer<typeof vaultTimeseriesPointSchema>
export type TVaultChartTimeseries = z.infer<typeof vaultChartTimeseriesSchema>
