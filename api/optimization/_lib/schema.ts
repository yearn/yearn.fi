import { z } from 'zod'

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

const StrategyDebtRatioSchema = z.object({
  strategy: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  name: z.string().min(1, 'Strategy name required').optional(),
  targetRatio: z.number().int().min(0).max(10000),
  currentRatio: z.number().int().min(0).max(10000),
  currentApr: z.number().int().min(0).optional(),
  targetApr: z.number().int().min(0).optional()
})

const VaultOptimizationSchema = z.object({
  vault: AddressSchema,
  strategyDebtRatios: z.array(StrategyDebtRatioSchema),
  currentApr: z.number().int().min(0),
  proposedApr: z.number().int().min(0),
  explain: z.string()
})

const VaultOptimizationsSchema = z.array(VaultOptimizationSchema)

export type StrategyDebtRatio = z.infer<typeof StrategyDebtRatioSchema>
export type VaultOptimization = z.infer<typeof VaultOptimizationSchema>

export function parseVaultOptimizations(data: unknown, sourceLabel = 'optimization payload'): VaultOptimization[] {
  const result = VaultOptimizationsSchema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    throw new Error(`Invalid ${sourceLabel}: ${firstError.path.join('.')} - ${firstError.message}`)
  }

  return result.data
}
