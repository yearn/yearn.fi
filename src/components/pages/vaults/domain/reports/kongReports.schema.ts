import { addressSchema } from '@shared/types'
import * as z from 'zod'

const nullableStringSchema = z.string().nullable().optional()
const nullableNumberSchema = z.union([z.number(), z.string(), z.null()]).transform((value) => {
  if (value === null || value === undefined) {
    return null
  }
  const asNumber = Number(value)
  return Number.isFinite(asNumber) ? asNumber : null
})

const kongReportSchema = z
  .object({
    chainId: z.number(),
    address: addressSchema,
    eventName: z.string().optional(),
    strategy: addressSchema,
    gain: nullableStringSchema,
    loss: nullableStringSchema,
    debtPaid: nullableStringSchema,
    totalGain: nullableStringSchema,
    totalLoss: nullableStringSchema,
    totalDebt: nullableStringSchema,
    debtAdded: nullableStringSchema,
    debtRatio: nullableStringSchema,
    currentDebt: nullableStringSchema,
    protocolFees: nullableStringSchema,
    totalFees: nullableStringSchema,
    totalRefunds: nullableStringSchema,
    gainUsd: nullableStringSchema,
    lossUsd: nullableStringSchema,
    debtPaidUsd: nullableStringSchema,
    totalGainUsd: nullableStringSchema,
    totalLossUsd: nullableStringSchema,
    totalDebtUsd: nullableStringSchema,
    debtAddedUsd: nullableStringSchema,
    currentDebtUsd: nullableStringSchema,
    protocolFeesUsd: nullableStringSchema,
    totalFeesUsd: nullableStringSchema,
    totalRefundsUsd: nullableStringSchema,
    apr: z
      .object({
        net: nullableNumberSchema,
        gross: nullableNumberSchema
      })
      .optional(),
    blockNumber: nullableNumberSchema,
    blockTime: nullableNumberSchema,
    logIndex: nullableNumberSchema,
    transactionHash: z.string().optional()
  })
  .passthrough()

export const kongReportsSchema = z.array(kongReportSchema)

export type TKongReport = z.infer<typeof kongReportSchema>
export type TKongReports = z.infer<typeof kongReportsSchema>
