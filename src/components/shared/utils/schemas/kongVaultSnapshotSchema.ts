import { zeroAddress } from 'viem'
import * as z from 'zod'

import { addressSchema } from '../../types'

const nullableNumberSchema = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => (value === null ? null : Number(value)))
const bigNumberishSchema = z.union([z.number(), z.string()]).transform((value) => String(value))
const nullableBigNumberishSchema = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => (value === null ? null : String(value)))
const decimalsSchema = z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value))

const snapshotTokenSchema = z
  .object({
    name: z.string().default('').catch(''),
    symbol: z.string().default('').catch(''),
    address: addressSchema,
    chainId: z.number(),
    decimals: decimalsSchema.catch(18),
    description: z.string().optional().default('').catch(''),
    displayName: z.string().optional().default('').catch(''),
    displaySymbol: z.string().optional().default('').catch(''),
    category: z.string().optional().default('').catch('')
  })
  .passthrough()

const snapshotApySchema = z
  .object({
    net: nullableNumberSchema.optional().catch(null),
    label: z.string().optional().default('').catch(''),
    grossApr: nullableNumberSchema.optional().catch(null),
    weeklyNet: nullableNumberSchema.optional().catch(null),
    monthlyNet: nullableNumberSchema.optional().catch(null),
    inceptionNet: nullableNumberSchema.optional().catch(null),
    pricePerShare: nullableBigNumberishSchema.optional().catch(null),
    weeklyPricePerShare: nullableBigNumberishSchema.optional().catch(null),
    monthlyPricePerShare: nullableBigNumberishSchema.optional().catch(null)
  })
  .nullable()
  .optional()
  .default(null)

const snapshotTvlSchema = z
  .object({
    close: nullableNumberSchema.optional().catch(null),
    label: z.string().optional().default('').catch(''),
    component: z.string().optional().default('').catch('')
  })
  .nullable()
  .optional()
  .default(null)

const snapshotFeesSchema = z
  .object({
    managementFee: nullableNumberSchema.optional().catch(null),
    performanceFee: nullableNumberSchema.optional().catch(null)
  })
  .nullable()
  .optional()
  .default(null)

const snapshotRiskScoreSchema = z
  .object({
    review: nullableNumberSchema.optional().catch(null),
    testing: nullableNumberSchema.optional().catch(null),
    complexity: nullableNumberSchema.optional().catch(null),
    riskExposure: nullableNumberSchema.optional().catch(null),
    protocolIntegration: nullableNumberSchema.optional().catch(null),
    centralizationRisk: nullableNumberSchema.optional().catch(null),
    externalProtocolAudit: nullableNumberSchema.optional().catch(null),
    externalProtocolCentralisation: nullableNumberSchema.optional().catch(null),
    externalProtocolTvl: nullableNumberSchema.optional().catch(null),
    externalProtocolLongevity: nullableNumberSchema.optional().catch(null),
    externalProtocolType: nullableNumberSchema.optional().catch(null),
    comment: z.string().optional().nullable().catch('')
  })
  .partial()

const snapshotRiskSchema = z
  .object({
    riskLevel: nullableNumberSchema.optional().catch(null),
    riskScore: snapshotRiskScoreSchema.optional()
  })
  .nullable()
  .optional()
  .default(null)

const snapshotPerformanceSchema = z
  .object({
    oracle: z
      .object({
        apr: nullableNumberSchema.optional().catch(null),
        apy: nullableNumberSchema.optional().catch(null)
      })
      .partial()
      .optional(),
    historical: z
      .object({
        net: nullableNumberSchema.optional().catch(null),
        weeklyNet: nullableNumberSchema.optional().catch(null),
        monthlyNet: nullableNumberSchema.optional().catch(null),
        inceptionNet: nullableNumberSchema.optional().catch(null)
      })
      .partial()
      .optional()
  })
  .optional()
  .default({})

const snapshotDebtSchema = z
  .object({
    strategy: addressSchema,
    currentDebt: bigNumberishSchema.optional(),
    maxDebt: bigNumberishSchema.optional().default('0').catch('0'),
    totalDebt: bigNumberishSchema.optional(),
    totalGain: bigNumberishSchema.optional(),
    totalLoss: bigNumberishSchema.optional(),
    performanceFee: nullableNumberSchema.optional().catch(null),
    lastReport: nullableNumberSchema.optional().catch(null),
    debtRatio: nullableNumberSchema.optional().catch(null),
    targetDebtRatio: nullableNumberSchema.optional().catch(null),
    maxDebtRatio: nullableNumberSchema.optional().catch(null),
    currentDebtUsd: nullableNumberSchema.optional().catch(null),
    maxDebtUsd: nullableNumberSchema.optional().catch(null)
  })
  .passthrough()

const snapshotMigrationSchema = z
  .object({
    target: addressSchema.optional().catch(zeroAddress),
    contract: addressSchema.optional().catch(zeroAddress),
    available: z.boolean().optional().default(false).catch(false)
  })
  .optional()
  .default({ target: zeroAddress, contract: zeroAddress, available: false })

const snapshotMetaSchema = z
  .object({
    kind: z.string().optional().default('').catch(''),
    name: z.string().optional().default('').catch(''),
    type: z.string().optional().default('').catch(''),
    token: snapshotTokenSchema.optional(),
    address: addressSchema.optional(),
    chainId: z.number().optional(),
    category: z.string().optional().default('').catch(''),
    isHidden: z.boolean().optional().default(false).catch(false),
    uiNotice: z.string().optional().default('').catch(''),
    isBoosted: z.boolean().optional().default(false).catch(false),
    isRetired: z.boolean().optional().default(false).catch(false),
    isHighlighted: z.boolean().optional().default(false).catch(false),
    migration: snapshotMigrationSchema.optional(),
    sourceURI: z.string().optional().default('').catch(''),
    description: z.string().optional().default('').catch(''),
    displayName: z.string().optional().default('').catch(''),
    displaySymbol: z.string().optional().default('').catch(''),
    shouldUseV2APR: z.boolean().optional().default(false).catch(false)
  })
  .passthrough()

const snapshotAssetSchema = z
  .object({
    name: z.string().default('').catch(''),
    symbol: z.string().default('').catch(''),
    address: addressSchema,
    chainId: z.number(),
    decimals: decimalsSchema.catch(18)
  })
  .passthrough()

export const kongVaultSnapshotSchema = z
  .object({
    address: addressSchema,
    chainId: z.number(),
    apiVersion: z.string().optional().nullable(),
    name: z.string().optional().default('').catch(''),
    symbol: z.string().optional().default('').catch(''),
    decimals: decimalsSchema.optional().catch(18),
    asset: snapshotAssetSchema.optional(),
    totalAssets: bigNumberishSchema.optional().default('0').catch('0'),
    apy: snapshotApySchema,
    tvl: snapshotTvlSchema,
    fees: snapshotFeesSchema,
    risk: snapshotRiskSchema,
    meta: snapshotMetaSchema.optional(),
    performance: snapshotPerformanceSchema.optional().default({}),
    debts: z.array(snapshotDebtSchema).optional().default([]),
    strategies: z.array(addressSchema).optional().default([])
  })
  .passthrough()

export type TKongVaultSnapshot = z.infer<typeof kongVaultSnapshotSchema>
export type TKongVaultSnapshotDebt = z.infer<typeof snapshotDebtSchema>
