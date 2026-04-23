import { addressSchema } from '@shared/types'
import { z } from 'zod'

const numberLikeSchema = z.union([z.number(), z.string()]).transform((value) => Number(value))
const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/)
const selectorSchema = z.string().regex(/^0x[a-fA-F0-9]{8}$/)

const archiveAllocationHistoryStrategySchema = z.object({
  strategyAddress: addressSchema,
  allocationPct: numberLikeSchema
})

export const archiveAllocationHistoryRecordSchema = z.object({
  id: z.string(),
  timestampUtc: z.string(),
  blockNumber: numberLikeSchema,
  txHash: hashSchema,
  inputSelector: selectorSchema,
  strategies: z.array(archiveAllocationHistoryStrategySchema)
})

export const archiveAllocationHistorySchema = z.array(archiveAllocationHistoryRecordSchema)
export const archiveAllocationHistoryArtifactSchema = z.object({
  chainId: numberLikeSchema,
  vaultAddress: addressSchema,
  generatedAt: z.string(),
  fromTimestampUtc: z.string(),
  strategyAddresses: z.array(addressSchema),
  records: archiveAllocationHistorySchema
})

export type TArchiveAllocationHistoryRecord = z.infer<typeof archiveAllocationHistoryRecordSchema>
export type TArchiveAllocationHistoryArtifact = z.infer<typeof archiveAllocationHistoryArtifactSchema>
