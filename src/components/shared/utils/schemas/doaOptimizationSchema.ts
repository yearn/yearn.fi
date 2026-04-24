import { addressSchema } from '@shared/types'
import { z } from 'zod'

const numberLikeSchema = z.union([z.number(), z.string()]).transform((value) => Number(value))
const nullableNumberLikeSchema = z.union([z.number(), z.string(), z.null()]).transform((value) => {
  return value === null ? null : Number(value)
})

const doaStrategyDebtRatioSchema = z.object({
  strategy: addressSchema,
  name: z.string().optional().default(''),
  targetRatio: numberLikeSchema,
  currentRatio: numberLikeSchema,
  currentApr: nullableNumberLikeSchema.optional().default(null),
  targetApr: nullableNumberLikeSchema.optional().default(null)
})

const doaOptimizationSourceSchema = z.object({
  key: z.string(),
  chainId: nullableNumberLikeSchema,
  revision: z.string(),
  isLatestAlias: z.boolean(),
  timestampUtc: z.string().nullable(),
  latestMatchedTimestampUtc: z.string().nullable()
})

export const doaOptimizationRecordSchema = z.object({
  vault: addressSchema,
  strategyDebtRatios: z.array(doaStrategyDebtRatioSchema),
  currentApr: numberLikeSchema,
  proposedApr: numberLikeSchema,
  explain: z.string(),
  source: doaOptimizationSourceSchema
})

export const doaOptimizationHistorySchema = z.array(doaOptimizationRecordSchema)

export type TDoaOptimizationRecord = z.infer<typeof doaOptimizationRecordSchema>
export type TDoaOptimizationStrategyDebtRatio = z.infer<typeof doaStrategyDebtRatioSchema>
