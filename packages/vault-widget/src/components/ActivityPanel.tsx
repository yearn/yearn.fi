'use client'

import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useVaultWidgetServices } from '../context'
import type { VaultWidgetToken } from '../types'
import { formatWidgetValue } from '../valueDisplay'

type WalletTab = 'balances' | 'transactions'

type ActivityPanelProps = {
  availableBalance: bigint
  availableToken: VaultWidgetToken
  depositedValueUsd: string
  onConnectWallet?: () => void
  positionBalance: bigint
  positionToken: VaultWidgetToken
}

function WalletIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18v4H6.5a1.5 1.5 0 0 0 0 3H20v8H6.5A2.5 2.5 0 0 1 4 16.5v-10ZM16 13h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function ActivityPanel({
  availableBalance,
  availableToken,
  depositedValueUsd,
  onConnectWallet,
  positionBalance,
  positionToken
}: ActivityPanelProps): ReactElement {
  const { address } = useAccount()
  const [activeTab, setActiveTab] = useState<WalletTab>('balances')
  const services = useVaultWidgetServices()
  const activityQuery = useQuery({
    queryKey: ['vault-widget', 'activity', address],
    queryFn: () => services.activityStore.list(address),
    enabled: !!address && activeTab === 'transactions'
  })

  return (
    <div className="yv-widget__wallet">
      <div className="yv-widget__wallet-header">
        <h3>Wallet</h3>
        <div className="yv-widget__wallet-tabs" role="tablist" aria-label="Wallet information">
          {(['balances', 'transactions'] as const).map((tab) => (
            <button
              data-active={activeTab === tab}
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'balances' ? 'Balances' : 'Transactions'}
            </button>
          ))}
        </div>
      </div>

      {!address ? (
        <div className="yv-widget__wallet-empty">
          <WalletIcon />
          <p>Connect a wallet to view balances and transactions.</p>
          <button type="button" onClick={() => onConnectWallet?.()}>
            Connect Wallet
          </button>
        </div>
      ) : activeTab === 'balances' ? (
        <div className="yv-widget__wallet-balances">
          <h4>Your Vault balances</h4>
          <dl>
            <div>
              <dt>Deposited value</dt>
              <dd>{depositedValueUsd}</dd>
            </div>
            <div>
              <dt>Vault position</dt>
              <dd>
                {formatWidgetValue(positionBalance, positionToken.decimals)} {positionToken.symbol}
              </dd>
            </div>
            <div>
              <dt>Available balance</dt>
              <dd>
                {formatWidgetValue(availableBalance, availableToken.decimals)} {availableToken.symbol}
              </dd>
            </div>
          </dl>
        </div>
      ) : activityQuery.isLoading ? (
        <div className="yv-widget__skeleton" aria-label="Loading activity" />
      ) : !activityQuery.data?.length ? (
        <p className="yv-widget__empty">No vault activity for this wallet yet.</p>
      ) : (
        <ol className="yv-widget__activity-list">
          {activityQuery.data.map((activity) => (
            <li className="yv-widget__activity-row" key={activity.id ?? `${activity.timestamp}:${activity.type}`}>
              <span>
                <strong>{activity.type}</strong>
                <small>{new Date(activity.timestamp).toLocaleString()}</small>
              </span>
              <span className={`yv-widget__status yv-widget__status--${activity.status}`}>{activity.status}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
