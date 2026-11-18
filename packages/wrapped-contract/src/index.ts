import { z } from 'zod'

const finite = z.number().finite()
const count = finite.int().nonnegative()
const point = z.object({ date: z.iso.date(), value: finite.nullable() })
export const wrappedSchema = z
  .object({
    version: z.literal(2),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    generatedAt: z.iso.datetime(),
    source: z.literal('yearn-holdings'),
    period: z.object({ year: z.literal(2026), start: z.iso.date(), end: z.iso.date(), partial: z.boolean() }),
    coverage: z.object({
      isComplete: z.boolean(),
      issues: z.array(z.string().max(300)).max(200),
      chains: z.array(z.object({ id: count, name: z.string().max(80) })).max(30)
    }),
    firstActivity: count.nullable(),
    return: z.object({
      pct: finite.nullable(),
      baselineDate: z.iso.date().nullable(),
      isComplete: z.boolean(),
      points: z.array(point).max(367)
    }),
    vaults: z
      .array(
        z.object({
          chainId: count,
          address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          label: z.string().max(200),
          heldDays: finite.nonnegative(),
          longestStreakDays: finite.nonnegative(),
          stillHolding: z.boolean(),
          isComplete: z.boolean()
        })
      )
      .max(2000),
    activity: z.object({
      deposits: count,
      withdrawals: count,
      transfers: count,
      monthly: z.array(z.object({ month: z.string().regex(/^2026-\d{2}$/), count })).max(12),
      hours: z.array(count).length(24)
    })
  })
  .superRefine((payload, context) => {
    if (payload.return.pct !== null && (!payload.return.isComplete || payload.return.baselineDate === null)) {
      context.addIssue({
        code: 'custom',
        message: 'A numeric return requires complete index coverage and a baseline.',
        path: ['return']
      })
    }
    if (payload.return.isComplete && payload.return.pct === null) {
      context.addIssue({
        code: 'custom',
        message: 'A complete return requires a finite percentage.',
        path: ['return', 'pct']
      })
    }
  })

export type TWrapped = z.infer<typeof wrappedSchema>

export function parseWrapped(input: unknown): TWrapped {
  return wrappedSchema.parse(input)
}
