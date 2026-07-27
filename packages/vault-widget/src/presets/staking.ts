import type { Address } from 'viem'
import { createStakingAdapter, createStakingPositionValueReader } from '../headless/staking'
import type { VaultWidgetConfig, VaultWidgetToken } from '../types'

export type CreateStakingPresetOptions = {
  chainId: number
  id?: string
  name: string
  source?: string
  stakingAddress: Address
  stakingToken: VaultWidgetToken
  vaultAddress: Address
  vaultToken: VaultWidgetToken
}

export function createStakingPreset(options: CreateStakingPresetOptions): VaultWidgetConfig {
  return {
    id: options.id ?? `${options.chainId}:${options.stakingAddress.toLowerCase()}`,
    name: options.name,
    chainId: options.chainId,
    vaultAddress: options.vaultAddress,
    positionToken: options.stakingToken,
    depositTokens: [options.vaultToken],
    withdrawTokens: [options.vaultToken],
    adapters: [
      createStakingAdapter({
        chainId: options.chainId,
        source: options.source,
        stakingAddress: options.stakingAddress,
        stakingToken: options.stakingToken,
        vaultToken: options.vaultToken
      })
    ],
    modes: ['deposit', 'withdraw', 'info'],
    defaultMode: 'deposit',
    defaultDepositToken: options.vaultToken.address,
    defaultWithdrawToken: options.vaultToken.address,
    copy: {
      approveAndDeposit: 'Approve & Stake',
      approveAndWithdraw: 'Approve & Unstake',
      submitDeposit: 'Stake',
      submitWithdraw: 'Unstake',
      unstakeAndRedeem: 'You will unstake',
      youWillDeposit: 'You will stake'
    },
    display: {
      approvalSpenderName: { deposit: options.stakingToken.symbol },
      assetPriceUsd: options.vaultToken.priceUsd,
      modeLabels: {
        deposit: 'Stake',
        withdraw: 'Unstake'
      },
      positionLabel: 'Staked shares'
    },
    readPositionValue: createStakingPositionValueReader({
      source: options.source,
      stakingAddress: options.stakingAddress
    })
  }
}
