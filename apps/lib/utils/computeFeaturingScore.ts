import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { Address } from 'viem'

import type { TDict } from '../types'

const FEATURE_HIGHLIGHT_MULTIPLIER = 1e18
const FEATURE_TVL_CAP = 1_000_000_000 // USD
const FEATURE_APR_CAP = 5 // 500%

type TFeaturingOverride = {
  address: Address
  useAprFrom?: 'base' | 'override'
  useTvlFrom?: 'base' | 'override'
  useHighlightFrom?: 'base' | 'override'
}

const clampValue = (value: number, cap: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(value, cap)
}

const getHighlightFlag = ({
  baseVault,
  overrideVault,
  override
}: {
  baseVault: TYDaemonVault
  overrideVault?: TYDaemonVault
  override?: TFeaturingOverride
}): boolean => {
  const source = override?.useHighlightFrom ?? 'base'
  const selectedVault = source === 'override' ? overrideVault : baseVault
  return selectedVault?.info?.isHighlighted ?? false
}

const getEffectiveApr = ({
  baseVault,
  overrideVault,
  override
}: {
  baseVault: TYDaemonVault
  overrideVault?: TYDaemonVault
  override?: TFeaturingOverride
}): number => {
  const source = override?.useAprFrom ?? 'base'
  const selectedVault = source === 'override' ? overrideVault : baseVault
  const apr = selectedVault?.apr?.netAPR ?? 0
  return clampValue(apr, FEATURE_APR_CAP)
}

const getEffectiveTvl = ({
  baseVault,
  overrideVault,
  override
}: {
  baseVault: TYDaemonVault
  overrideVault?: TYDaemonVault
  override?: TFeaturingOverride
}): number => {
  const source = override?.useTvlFrom ?? 'base'
  const selectedVault = source === 'override' ? overrideVault : baseVault
  const tvl = selectedVault?.tvl?.tvl ?? 0
  return clampValue(tvl, FEATURE_TVL_CAP)
}

type TComputeFeaturingScoreInput = {
  baseVault: TYDaemonVault
  overrideVault?: TYDaemonVault
  override?: TFeaturingOverride
}

const computeFeaturingScore = ({ baseVault, overrideVault, override }: TComputeFeaturingScoreInput): number => {
  const apr = getEffectiveApr({ baseVault, overrideVault, override })
  const tvl = getEffectiveTvl({ baseVault, overrideVault, override })
  const highlight = getHighlightFlag({ baseVault, overrideVault, override })

  const baseScore = tvl * apr
  return highlight ? baseScore * FEATURE_HIGHLIGHT_MULTIPLIER : baseScore
}

const applyFeaturingScores = (
  vaults: TDict<TYDaemonVault>,
  overrides: Record<Address, TFeaturingOverride>,
  opts?: { warn?: (message: string) => void }
): TDict<TYDaemonVault> => {
  const warn = opts?.warn ?? ((msg: string): void => console.warn(msg))

  const result: TDict<TYDaemonVault> = {}
  for (const [address, vault] of Object.entries(vaults)) {
    const override = overrides[address as Address]
    const overrideVault = override ? vaults[override.address] : undefined

    if (override && !overrideVault) {
      warn(
        `[featuringScore] override target missing; base=${address} override=${override.address}. Falling back to base values.`
      )
    }

    const effectiveOverride = overrideVault ? override : undefined
    const featuringScore = computeFeaturingScore({ baseVault: vault, overrideVault, override: effectiveOverride })
    result[address as Address] = { ...vault, featuringScore }
  }
  return result
}

export {
  FEATURE_APR_CAP,
  FEATURE_HIGHLIGHT_MULTIPLIER,
  FEATURE_TVL_CAP,
  applyFeaturingScores,
  clampValue,
  computeFeaturingScore
}
export type { TFeaturingOverride }
