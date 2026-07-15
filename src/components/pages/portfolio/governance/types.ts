import type { TAddress } from '@shared/types'

export type TGovernanceCooldown = {
  amountRaw: bigint
  endsAt: number
  totalRaw: bigint
}

export type TGovernanceReward = {
  tokenAddress: TAddress
  symbol: string
  amountRaw: bigint
  amountNormalized: number
  usdValue: number
}

export type TGovernancePositionKind = 'styfi' | 'styfix' | 'veyfi' | 'llyfi'

export type TGovernancePosition = {
  id: string
  kind: TGovernancePositionKind
  name: string
  symbol: string
  subtitle: string
  href: string
  tokenAddress: TAddress
  amountRaw: bigint
  amountNormalized: number
  amountYfiRaw: bigint
  amountYfiNormalized: number
  activeRaw: bigint
  cooldownRaw: bigint
  withdrawableRaw: bigint
  walletRaw: bigint
  valueUsd: number
  tvlYfiRaw: bigint
  tvlYfiNormalized: number
  tvlUsd: number
  apy: number | null
  unlockTime?: number
  boostMultiplier?: number
  cooldown?: TGovernanceCooldown | null
  reward?: TGovernanceReward | null
}

export type TGovernanceGlobalData = {
  meta: {
    epoch: number
    timestamp?: number
  }
  global: {
    maxBoostBps: number | string
    yfi?: {
      totalSupply?: string
      priceCts?: string
    }
    veyfi?: {
      lockedYfi?: string
      migratedYfi?: string
      totalLlyfiStakedBps?: number | string
      inventory?: {
        availableYfi?: string
        feeBps?: number | string
      }
      tokens?: Array<{
        symbol: string
        redemption: {
          enabled?: boolean
          capacity?: string
          used?: string
          inventory?: string
        }
      }>
    }
  }
  styfi: {
    staked?: string
    unstaking?: string
    current: { aprBps: number | string }
    projected: { aprBps: number | string }
  }
  styfix: {
    staked?: string
    unstaking?: string
    current: { aprBps: number | string }
    projected: { aprBps: number | string }
  }
  llyfi: Array<{
    symbol: string
    staked?: string
    unstaking?: string
    current: { aprBps: number | string }
    projected: { aprBps: number | string }
  }>
}

export type TGovernanceRawReward = {
  amountRaw: bigint
  tokenAddress: TAddress
  tokenSymbol: string
  tokenDecimals: number
}

export type TGovernanceRawStyfiAccount = {
  styfiActive: bigint
  styfiStream: readonly [bigint, bigint, bigint]
  styfiWithdrawable: bigint
  styfixActive: bigint
  styfixStream: readonly [bigint, bigint, bigint]
  styfixWithdrawable: bigint
  reward: TGovernanceRawReward | null
}

export type TGovernanceRawVeyfiAccount = {
  legacyBalance: bigint
  lockedAmount: bigint
  migrated: boolean
  migrationEligible: boolean
  unlockTime: number
  boostEpochs: number | null
  reward: TGovernanceRawReward | null
}

export type TGovernanceRawLiquidLockerAccount = {
  id: string
  index: number
  name: string
  symbol: 'sdYFI' | 'upYFI' | 'coveYFI'
  tokenAddress: TAddress
  scale: bigint
  walletBalance: bigint
  stakedShares: bigint
  stream: readonly [bigint, bigint, bigint]
  withdrawable: bigint
  reward?: TGovernanceRawReward | null
}

export type TGovernanceRawAccount = {
  styfi: TGovernanceRawStyfiAccount
  veyfi: TGovernanceRawVeyfiAccount
  liquidLockers: TGovernanceRawLiquidLockerAccount[]
}
