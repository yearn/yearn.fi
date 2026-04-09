import type { TStakingReward } from './types'
import { toNormalizedValue } from '@shared/utils'

type TYieldSplitterClaimCopy = {
  confirmMessage: string
  successMessage: string
  ctaLabel: string
}

function formatClaimEntry(reward: TStakingReward): string {
  const normalizedAmount = toNormalizedValue(reward.amount, reward.decimals)
  return `${normalizedAmount.toFixed(4)} ${reward.symbol}`
}

export function buildYieldSplitterClaimCopy(rewards: TStakingReward[]): TYieldSplitterClaimCopy {
  if (rewards.length === 1) {
    const [reward] = rewards
    return {
      confirmMessage: `Claim ${formatClaimEntry(reward)}`,
      successMessage: `You claimed ${formatClaimEntry(reward)}`,
      ctaLabel: 'Claim'
    }
  }

  const rewardsSummary = rewards.map(formatClaimEntry).join(', ')
  const rewardSymbols = rewards.map((reward) => reward.symbol).join(', ')

  return {
    confirmMessage: `Claim all yield splitter rewards (${rewardsSummary})`,
    successMessage: `You claimed all available yield splitter rewards: ${rewardSymbols}.`,
    ctaLabel: 'Claim all'
  }
}
