import { YCRV_APP_URL, YCRV_TOKEN_ADDRESS, YVCRVUSD_REWARD_ADDRESS } from '@pages/portfolio/ycrv/constants'
import type { TYcrvPosition, TYcrvRawAccount, TYcrvReward } from '@pages/portfolio/ycrv/types'
import { toNormalizedValue } from '@shared/utils'
import { formatUnits } from 'viem'

const YCRV_DECIMALS = 18
const REWARD_DECIMALS = 18

function getFinitePositiveValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function getWadValue(value: bigint): number {
  const normalized = Number(formatUnits(value, 18))
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0
}

export function deriveYcrvPosition(raw: TYcrvRawAccount | null | undefined, ycrvPrice: number): TYcrvPosition | null {
  if (!raw || raw.balanceRaw <= 0n) {
    return null
  }

  const normalizedPrice = getFinitePositiveValue(ycrvPrice)
  const amountNormalized = toNormalizedValue(raw.balanceRaw, YCRV_DECIMALS)
  const totalSupplyNormalized = toNormalizedValue(raw.totalSupplyRaw, YCRV_DECIMALS)
  const activeApr = getWadValue(raw.userActiveAprRaw)
  const boostMultiplier = getWadValue(raw.userActiveBoostRaw)

  return {
    id: 'ycrv-boosted-staker',
    kind: 'ycrv-staker',
    name: 'Staked yCRV',
    symbol: 'yCRV',
    href: YCRV_APP_URL,
    tokenAddress: YCRV_TOKEN_ADDRESS,
    decimals: YCRV_DECIMALS,
    amountRaw: raw.balanceRaw,
    amountNormalized,
    activeRaw: raw.balanceRaw,
    cooldownRaw: 0n,
    withdrawableRaw: 0n,
    walletRaw: 0n,
    valueUsd: amountNormalized * normalizedPrice,
    tvlUsd: totalSupplyNormalized * normalizedPrice,
    apy: activeApr > 0 ? activeApr : null,
    boostMultiplier: boostMultiplier > 0 ? boostMultiplier : undefined
  }
}

export function deriveYcrvReward(raw: TYcrvRawAccount | null | undefined, rewardPrice: number): TYcrvReward | null {
  if (!raw || raw.claimableRewardRaw <= 0n) {
    return null
  }

  const amountNormalized = toNormalizedValue(raw.claimableRewardRaw, REWARD_DECIMALS)
  return {
    tokenAddress: YVCRVUSD_REWARD_ADDRESS,
    symbol: 'yvcrvUSD-2',
    amountRaw: raw.claimableRewardRaw,
    amountNormalized,
    usdValue: amountNormalized * getFinitePositiveValue(rewardPrice)
  }
}
