import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { z } from 'zod'

export const CURVE_POOL_APY_TYPE = 'curve-pool'
export const CURVE_CHAIN_NAMES: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  250: 'fantom',
  8453: 'base',
  42161: 'arbitrum',
  146: 'sonic'
}

const curveAddress = z
  .string()
  .regex(/^0x[\da-f]{40}$/i)
  .transform((address) => address.toLowerCase())
const poolSchema = z.object({
  address: curveAddress,
  lpTokenAddress: curveAddress.optional(),
  isBroken: z.boolean().optional()
})
const baseApySchema = z.object({
  address: curveAddress,
  latestDailyApyPcent: z.number().nullable(),
  latestWeeklyApyPcent: z.number().nullable().optional()
})
const poolsSchema = z.object({ success: z.literal(true), data: z.object({ poolData: z.array(z.unknown()) }) })
const baseApysSchema = z.object({ success: z.literal(true), data: z.object({ baseApys: z.array(z.unknown()) }) })

// getBaseApys already includes applicable LST yield. Never add it again, or use gauge rewards.
export function resolveCurvePoolApys(poolsPayload: unknown, apysPayload: unknown): Record<string, number> {
  const pools = poolsSchema.parse(poolsPayload).data.poolData
  const apys = baseApysSchema.parse(apysPayload).data.baseApys
  const byPool = new Map(
    apys.flatMap((entry) => {
      const parsed = baseApySchema.safeParse(entry)
      if (!parsed.success) return []
      const apy = parsed.data.latestDailyApyPcent ?? parsed.data.latestWeeklyApyPcent
      return typeof apy === 'number' && Number.isFinite(apy) ? [[parsed.data.address, apy / 100] as const] : []
    })
  )

  return Object.fromEntries(
    pools.flatMap((entry) => {
      const parsed = poolSchema.safeParse(entry)
      if (!parsed.success || parsed.data.isBroken) return []
      const apy = byPool.get(parsed.data.address)
      return apy === undefined ? [] : [[parsed.data.lpTokenAddress ?? parsed.data.address, apy]]
    })
  )
}

function isV2CurveWithZeroEstimate(
  version: string | null | undefined,
  category: string | null | undefined,
  apy: unknown
): boolean {
  return /^(0\.|2(?:\.|$))/.test(version ?? '') && category?.toLowerCase() === 'curve' && apy === 0
}

export function isCurvePoolApyCandidate(vault: TKongVaultInput): boolean {
  if ('chainID' in vault) {
    return (
      Boolean(CURVE_CHAIN_NAMES[vault.chainID]) &&
      vault.tvl.tvl > 0 &&
      isV2CurveWithZeroEstimate(vault.version, vault.category, vault.apr.forwardAPR.netAPR)
    )
  }
  return (
    !vault.v3 &&
    Boolean(CURVE_CHAIN_NAMES[vault.chainId]) &&
    (vault.tvl ?? 0) > 0 &&
    isV2CurveWithZeroEstimate(vault.apiVersion, vault.category, vault.performance?.estimated?.apy)
  )
}

function parseBalance(value: unknown): bigint | undefined {
  return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : undefined
}

export function isIdleCurveVault(snapshot: TKongVaultSnapshot | undefined): snapshot is TKongVaultSnapshot {
  if (
    !snapshot ||
    !CURVE_CHAIN_NAMES[snapshot.chainId] ||
    !isV2CurveWithZeroEstimate(
      snapshot.apiVersion,
      snapshot.meta?.category ?? snapshot.meta?.token?.category,
      snapshot.performance?.estimated?.apy
    )
  )
    return false

  const assets = parseBalance(snapshot.totalAssets)
  // Zero APY or a zero target debt ratio alone does not prove that strategies have returned their assets.
  return (
    assets !== undefined &&
    assets > 0n &&
    parseBalance(snapshot.totalDebt) === 0n &&
    parseBalance(snapshot.totalIdle) === assets
  )
}

export function getIdleCurveEstimate(
  snapshot: TKongVaultSnapshot | undefined,
  poolApys: Record<string, number> | undefined
) {
  if (!isIdleCurveVault(snapshot)) return undefined
  const token = snapshot.asset?.address ?? snapshot.meta?.token?.address
  const apy = token ? poolApys?.[token.toLowerCase()] : undefined
  if (apy === undefined || !Number.isFinite(apy)) return undefined

  return { apy, type: CURVE_POOL_APY_TYPE, components: { poolAPY: apy } }
}
