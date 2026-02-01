import * as z from 'zod'

import { addressSchema } from '../../types'

const coerceNullableNumber = z.preprocess(
  (val) => (val === null || val === undefined ? null : Number(val)),
  z.number().nullable()
)

export const kongVaultListItemSchema = z.object({
  chainId: z.number(),
  address: addressSchema,
  name: z.string(),
  symbol: z.string().nullable(),
  apiVersion: z.string().nullable(),
  decimals: z.number().nullable(),

  asset: z
    .object({
      address: addressSchema,
      name: z.string(),
      symbol: z.string(),
      decimals: coerceNullableNumber
    })
    .nullish(),

  tvl: z.number().nullable(),

  performance: z
    .object({
      oracle: z
        .object({
          apr: coerceNullableNumber,
          apy: coerceNullableNumber
        })
        .nullish(),
      estimated: z
        .object({
          apy: coerceNullableNumber,
          type: z.string().nullable().optional()
        })
        .nullish(),
      historical: z
        .object({
          net: coerceNullableNumber,
          weeklyNet: coerceNullableNumber,
          monthlyNet: coerceNullableNumber,
          inceptionNet: coerceNullableNumber
        })
        .nullish()
    })
    .nullish(),

  fees: z
    .object({
      managementFee: z.number(),
      performanceFee: z.number()
    })
    .nullable(),

  category: z.string().nullable(),
  type: z.string().nullable(),
  kind: z.string().nullable(),

  v3: z.boolean(),
  yearn: z.boolean().optional(),
  isRetired: z.boolean(),
  isHidden: z.boolean(),
  isBoosted: z.boolean(),
  isHighlighted: z.boolean(),

  inclusion: z.record(z.string(), z.boolean()).optional(),
  migration: z.boolean().optional(),
  origin: z.string().nullable().optional(),

  strategiesCount: z.number(),
  riskLevel: z.number().nullable()
})

export const kongVaultListSchema = z.array(kongVaultListItemSchema)

export type TKongVaultListItem = z.infer<typeof kongVaultListItemSchema>
export type TKongVaultList = z.infer<typeof kongVaultListSchema>
