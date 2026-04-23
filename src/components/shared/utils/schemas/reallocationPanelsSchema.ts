import { addressSchema } from '@shared/types'
import { z } from 'zod'

const numberLikeSchema = z.union([z.number(), z.string()]).transform((value) => Number(value))
const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/)
const selectorSchema = z.string().regex(/^0x[a-fA-F0-9]{8}$/)

export const reallocationStateStrategySchema = z.object({
  strategyId: z.string(),
  strategyAddress: addressSchema.nullable(),
  name: z.string(),
  isUnallocated: z.boolean(),
  allocationPct: numberLikeSchema
})

export const reallocationStateSchema = z.object({
  id: z.string(),
  timestampUtc: z.string().nullable(),
  origin: z.enum(['redis', 'archive', 'current', 'proposal']),
  strategies: z.array(reallocationStateStrategySchema)
})

const baseReallocationPanelSchema = z.object({
  id: z.string(),
  beforeState: reallocationStateSchema,
  afterState: reallocationStateSchema,
  beforeTimestampUtc: z.string().nullable(),
  afterTimestampUtc: z.string().nullable(),
  annotation: z.string().nullable(),
  kind: z.enum(['historical', 'proposal', 'current'])
})

export const reallocationPanelSchema = baseReallocationPanelSchema.extend({
  annotationTone: z.enum(['automatic', 'selector']).nullable().optional(),
  reallocationType: z.enum(['automatic', 'manual']).nullable().optional(),
  inputSelector: selectorSchema.nullable().optional(),
  txHash: hashSchema.nullable().optional(),
  createdBy: addressSchema.nullable().optional(),
  to: addressSchema.nullable().optional()
})

export const reallocationApiPanelSchema = baseReallocationPanelSchema.extend({
  annotationTone: z.enum(['automatic', 'selector']).nullable(),
  reallocationType: z.enum(['automatic', 'manual']).nullable(),
  inputSelector: selectorSchema.nullable(),
  txHash: hashSchema.nullable(),
  createdBy: addressSchema.nullable(),
  to: addressSchema.nullable()
})

export const reallocationPanelsSchema = z.array(reallocationApiPanelSchema)

const sankeyMockupPanelMetaSchema = z.object({
  annotationTone: z.enum(['automatic', 'selector']),
  changeSource: z.enum(['automatic', 'selector']),
  createdBy: addressSchema.nullable(),
  inputSelector: selectorSchema,
  to: addressSchema.nullable(),
  topChanges: z.array(
    z.object({
      afterAllocationPct: numberLikeSchema,
      beforeAllocationPct: numberLikeSchema,
      deltaPct: numberLikeSchema,
      name: z.string()
    })
  ),
  txHash: hashSchema
})

export const sankeyMockupFeedSchema = z.object({
  generatedAt: z.string(),
  panelMeta: z.record(z.string(), sankeyMockupPanelMetaSchema),
  panels: z.array(reallocationPanelSchema),
  vaultAddress: addressSchema,
  vaultLabel: z.string()
})

export const sankeyMockupFeedsSchema = z.array(sankeyMockupFeedSchema)

export type TReallocationPanelRecord = z.infer<typeof reallocationApiPanelSchema>
export type TSankeyMockupFeed = z.infer<typeof sankeyMockupFeedSchema>
