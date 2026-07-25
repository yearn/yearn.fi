'use client'

import { useQuery } from '@tanstack/react-query'
import type { ComponentType, ReactElement } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { useVaultWidgetServices } from '../context'
import { useVaultWidgetActionController } from '../headless/useVaultWidgetActionController'
import type { VaultWidgetDiscoveredReward } from '../services/rewards'
import type { VaultWidgetConfig, VaultWidgetEvent, VaultWidgetToken } from '../types'
import { formatRewardAmount } from '../valueDisplay'
import { TransactionStatus } from './TransactionStatus'

type RewardRowProps = {
  config: VaultWidgetConfig
  onEvent?: (event: VaultWidgetEvent) => void
  onError?: (event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }>) => void
  onRefresh: () => Promise<void>
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  reward: VaultWidgetDiscoveredReward
  TokenIcon: ComponentType<{ token: VaultWidgetToken; size: number }>
}

function DefaultTokenIcon({ token, size }: { token: VaultWidgetToken; size: number }): ReactElement {
  return token.logoURI ? (
    <img className="yv-widget__token-icon" src={token.logoURI} alt="" width={size} height={size} />
  ) : (
    <span className="yv-widget__token-fallback" style={{ width: size, height: size }} aria-hidden="true">
      {token.symbol.slice(0, 1)}
    </span>
  )
}

function RewardRow({
  config,
  onError,
  onEvent,
  onRefresh,
  onSuccess,
  reward,
  TokenIcon
}: RewardRowProps): ReactElement {
  const action = useVaultWidgetActionController({
    activity: {
      chainId: config.chainId,
      destinationChainId: config.chainId,
      tokenOut: reward.token.address
    },
    mode: 'rewards',
    onError,
    onEvent,
    onRefresh,
    onSuccess,
    quote: reward.quote
  })

  return (
    <li className="yv-widget__reward-row">
      <TokenIcon token={reward.token} size={32} />
      <span>
        <strong>{reward.token.symbol}</strong>
        <small>{reward.kind === 'merkle' ? 'Merkle reward' : 'Staking reward'}</small>
      </span>
      <span>
        <strong>{formatRewardAmount(reward.amount, reward.token.decimals)}</strong>
        <small>
          {reward.usdValue.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2
          })}
        </small>
      </span>
      <button type="button" disabled={!action.canSubmit} onClick={() => void action.submit()}>
        Claim
      </button>
      <TransactionStatus execution={action.execution} />
    </li>
  )
}

export function RewardsPanel({
  config,
  onConnectWallet,
  onError,
  onEvent,
  onRefresh,
  onSuccess,
  TokenIcon = DefaultTokenIcon
}: {
  config: VaultWidgetConfig
  onConnectWallet?: () => void
  onError?: (event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }>) => void
  onEvent?: (event: VaultWidgetEvent) => void
  onRefresh: () => Promise<void>
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  TokenIcon?: ComponentType<{ token: VaultWidgetToken; size: number }>
}): ReactElement {
  const { address: account } = useAccount()
  const publicClient = usePublicClient({ chainId: config.chainId })
  const services = useVaultWidgetServices()
  const rewardsQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'rewards', account],
    queryFn: ({ signal }) => {
      if (!account || !publicClient) return []
      return services.rewards.discover({ account, config, publicClient, signal })
    },
    enabled: !!account && !!publicClient,
    staleTime: 30_000
  })
  const refresh = async (): Promise<void> => {
    await Promise.allSettled([rewardsQuery.refetch(), onRefresh()])
  }
  const totalUsd = (rewardsQuery.data ?? []).reduce((total, reward) => total + reward.usdValue, 0)

  if (!account) {
    return (
      <div className="yv-widget__workflow yv-widget__workflow--empty">
        <p>Connect a wallet to discover claimable rewards.</p>
        <button className="yv-widget__button yv-widget__button--primary" type="button" onClick={onConnectWallet}>
          Connect Wallet
        </button>
      </div>
    )
  }

  if (rewardsQuery.isLoading) {
    return <div className="yv-widget__skeleton" aria-label="Loading rewards" />
  }

  if (rewardsQuery.error) {
    return (
      <div className="yv-widget__notice yv-widget__notice--error" role="alert">
        {rewardsQuery.error.message}
      </div>
    )
  }

  if (!rewardsQuery.data?.length) {
    return <p className="yv-widget__empty">No claimable rewards yet.</p>
  }

  return (
    <div className="yv-widget__workflow">
      <div className="yv-widget__workflow-balance">
        <span>Claimable Rewards</span>
        <strong>
          {totalUsd.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2
          })}
        </strong>
      </div>
      <ul className="yv-widget__reward-list">
        {rewardsQuery.data.map((reward) => (
          <RewardRow
            key={reward.id}
            config={config}
            onError={onError}
            onEvent={onEvent}
            onRefresh={refresh}
            onSuccess={onSuccess}
            reward={reward}
            TokenIcon={TokenIcon}
          />
        ))}
      </ul>
    </div>
  )
}
