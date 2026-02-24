import { addressSchema } from '@shared/types'
import * as z from 'zod'

const numberSchema = z.union([z.number(), z.string()]).transform((value) => Number(value))
const nullableNumberSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => (value === null || value === undefined ? null : Number(value)))
const bigNumberishSchema = z.union([z.number(), z.string()]).transform((value) => String(value))

const yvUsdAprServiceComponentSchema = z
  .object({
    label: z.string().optional().default('').catch(''),
    apr: numberSchema.optional().default(0).catch(0),
    apy: numberSchema.optional().default(0).catch(0),
    source: z.string().optional().default('').catch(''),
    meta: z.record(z.string(), z.unknown()).optional().default({})
  })
  .passthrough()

const yvUsdAprServiceStrategyMetaSchema = z
  .object({
    name: z.string().optional().default('').catch(''),
    type: z.string().optional().default('').catch('')
  })
  .passthrough()

const yvUsdAprServiceStrategySchema = z
  .object({
    address: addressSchema,
    apr_source: z.string().optional().default('').catch(''),
    offchain: z.record(z.string(), z.unknown()).optional().default({}),
    meta: yvUsdAprServiceStrategyMetaSchema.optional().default({ name: '', type: '' }),
    points: z.boolean().optional().default(false).catch(false),
    apr_raw: bigNumberishSchema.optional().default('0').catch('0'),
    net_apr_raw: bigNumberishSchema.optional().default('0').catch('0'),
    weighted_apr_raw: bigNumberishSchema.optional().default('0').catch('0'),
    weight: numberSchema.optional().default(0).catch(0),
    debt: bigNumberishSchema.optional().default('0').catch('0')
  })
  .passthrough()

const yvUsdAprServiceMetaSchema = z
  .object({
    strategies: z.array(yvUsdAprServiceStrategySchema).optional().default([]).catch([]),
    asset: addressSchema.optional().catch(undefined)
  })
  .passthrough()

const yvUsdAprServiceVaultSchema = z
  .object({
    name: z.string().optional().default('').catch(''),
    symbol: z.string().optional().default('').catch(''),
    address: addressSchema,
    chain_id: numberSchema.optional().default(1).catch(1),
    apr: nullableNumberSchema.optional().default(null).catch(null),
    apy: nullableNumberSchema.optional().default(null).catch(null),
    components: z.array(yvUsdAprServiceComponentSchema).optional().default([]).catch([]),
    meta: yvUsdAprServiceMetaSchema.optional().default({ strategies: [] })
  })
  .passthrough()

export const yvUsdAprServiceSchema = z.record(z.string(), yvUsdAprServiceVaultSchema)

export type TYvUsdAprServiceResponse = z.infer<typeof yvUsdAprServiceSchema>
export type TYvUsdAprServiceVault = z.infer<typeof yvUsdAprServiceVaultSchema>
export type TYvUsdAprServiceStrategy = z.infer<typeof yvUsdAprServiceStrategySchema>
