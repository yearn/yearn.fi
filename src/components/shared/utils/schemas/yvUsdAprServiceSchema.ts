import { addressSchema } from '@shared/types'
import * as z from 'zod'

const yvUsdAprServiceStrategySchema = z
  .object({
    address: addressSchema.optional().catch(undefined),
    points: z.boolean().optional().default(false).catch(false)
  })
  .passthrough()

const yvUsdAprServiceMetaSchema = z
  .object({
    strategies: z.array(yvUsdAprServiceStrategySchema).optional().default([]).catch([])
  })
  .passthrough()

const yvUsdAprServiceVaultSchema = z
  .object({
    address: addressSchema,
    meta: yvUsdAprServiceMetaSchema.optional().default({ strategies: [] })
  })
  .passthrough()

export const yvUsdAprServicePointsSchema = z.record(z.string(), yvUsdAprServiceVaultSchema)

export type TYvUsdAprServicePointsResponse = z.infer<typeof yvUsdAprServicePointsSchema>
export type TYvUsdAprServicePointsVault = z.infer<typeof yvUsdAprServiceVaultSchema>
