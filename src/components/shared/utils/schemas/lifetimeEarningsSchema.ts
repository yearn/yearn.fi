import * as z from 'zod'

/**
 * Lifetime-earnings headline served by /api/earnings/headline.
 *
 * A compute bot writes the raw snapshot fields to Redis; the server
 * extrapolates them to `value` at `computed_at_ms` and the client keeps the
 * number moving from there using `rate_usd_per_sec`.
 */
export const lifetimeEarningsHeadlineSchema = z.object({
  net_yield_usd: z.number(),
  as_of_ms: z.number(),
  rate_usd_per_sec: z.number().nonnegative(),
  prev_net_yield_usd: z.number(),
  prev_as_of_ms: z.number(),
  run_id: z.string(),
  value: z.number(),
  computed_at_ms: z.number()
})

export type TLifetimeEarningsHeadline = z.infer<typeof lifetimeEarningsHeadlineSchema>
