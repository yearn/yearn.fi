'use client'

import { useQuery } from '@tanstack/react-query'
import {
  type ComponentType,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { formatUnits, type Hash, isAddressEqual } from 'viem'
import { useAccount, useConfig, usePublicClient } from 'wagmi'
import { useVaultWidgetServices } from '../context'
import { readVaultWidgetCooldownState, type VaultWidgetCooldownState } from '../headless/lockedVault'
import {
  filterVaultWidgetActivities,
  getVaultWidgetRelatedAddresses,
  reconcileVaultWidgetActivity,
  updateVaultWidgetActivitySafely
} from '../services/activity'
import type { VaultWidgetActivity, VaultWidgetConfig, VaultWidgetPositionSourceState, VaultWidgetToken } from '../types'
import { formatWidgetValue } from '../valueDisplay'

type WalletTab = 'balances' | 'transactions'

type ActivityPanelProps = {
  availableBalance: bigint
  availableToken: VaultWidgetToken
  config: VaultWidgetConfig
  depositedValue: bigint
  depositedValueDecimals: number
  depositedValueUsd: string
  onConnectWallet?: () => void
  onViewAllActivity?: () => void
  positionSources: readonly VaultWidgetPositionSourceState[]
  TransactionLink?: ComponentType<{ chainId: number; hash: Hash; children: ReactNode }>
}

const WALLET_TABS = [
  { id: 'balances', label: 'Balances' },
  { id: 'transactions', label: 'Transactions' }
] as const

export function getNextWalletTabIndex(key: string, index: number, tabCount: number): number | undefined {
  if (key === 'ArrowRight') return (index + 1) % tabCount
  if (key === 'ArrowLeft') return (index - 1 + tabCount) % tabCount
  if (key === 'Home') return 0
  if (key === 'End') return tabCount - 1
  return undefined
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

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatDuration(seconds: number): string {
  const days = Math.floor(Math.max(0, seconds) / 86_400)
  const hours = Math.floor((Math.max(0, seconds) % 86_400) / 3_600)
  if (days > 0) return `${days}d ${hours}h`
  const minutes = Math.ceil(Math.max(0, seconds) / 60)
  return `${minutes}m`
}

function getToken(config: VaultWidgetConfig, address?: `0x${string}`): VaultWidgetToken | undefined {
  if (!address) return undefined
  const tokens = [
    config.positionToken,
    ...config.depositTokens,
    ...config.withdrawTokens,
    ...(config.positionSources ?? []).map(({ token }) => token),
    ...(config.infoPositionSources ?? []).map(({ token }) => token),
    ...(config.rewards?.tokens ?? []),
    config.migration?.targetToken
  ].filter((token): token is VaultWidgetToken => !!token)
  return tokens.find((token) => isAddressEqual(token.address, address))
}

export function getVaultWidgetActivityAmountLabel(activity: VaultWidgetActivity, config: VaultWidgetConfig): string {
  const token = getToken(config, activity.tokenIn) ?? getToken(config, activity.tokenOut)
  return token ? `${activity.amount} ${token.symbol}` : activity.amount
}

function getPositionUnit(source: VaultWidgetPositionSourceState): string {
  return source.token.symbol.length > 'vault shares'.length ? 'vault shares' : source.token.symbol
}

function getPositionLabel(source: VaultWidgetPositionSourceState): string {
  if (source.balanceLabel) return source.balanceLabel
  return source.withdrawLabel ? 'Staked shares' : 'Deposited shares'
}

function ActivityStatus({ status }: { status: VaultWidgetActivity['status'] }): ReactElement {
  const label = status.slice(0, 1).toUpperCase() + status.slice(1)
  return (
    <span className={`yv-widget__status yv-widget__status--${status}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  )
}

function ActivityRow({
  activity,
  config,
  TransactionLink
}: {
  activity: VaultWidgetActivity
  config: VaultWidgetConfig
  TransactionLink?: ActivityPanelProps['TransactionLink']
}): ReactElement {
  const hash = activity.destinationHash ?? activity.hash
  const chainId = activity.destinationHash ? (activity.destinationChainId ?? activity.chainId) : activity.chainId
  const hashLabel = hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : undefined

  return (
    <li className="yv-widget__activity-row">
      <span className="yv-widget__activity-copy">
        <strong>{activity.type}</strong>
        <small>{getVaultWidgetActivityAmountLabel(activity, config)}</small>
        {hash && hashLabel ? (
          TransactionLink ? (
            <TransactionLink chainId={chainId} hash={hash}>
              {hashLabel}
            </TransactionLink>
          ) : (
            <span className="yv-widget__activity-hash">{hashLabel}</span>
          )
        ) : (
          <span className="yv-widget__activity-hash">
            {activity.proposalId ? 'Safe proposal submitted' : 'Waiting for wallet'}
          </span>
        )}
      </span>
      <ActivityStatus status={activity.status} />
    </li>
  )
}

function CooldownStatus({
  state,
  assets,
  assetToken,
  shareToken
}: {
  state: VaultWidgetCooldownState
  assets: bigint
  assetToken: VaultWidgetToken
  shareToken: VaultWidgetToken
}): ReactElement | null {
  if (state.shares <= 0n) return null
  const remaining =
    state.state === 'cooling'
      ? `Cooldown remaining: ${formatDuration(state.cooldownEnd - state.now)}`
      : state.state === 'ready'
        ? `Withdrawal window remaining: ${formatDuration(state.windowEnd - state.now)}`
        : 'Withdrawal window closed. Start a new cooldown to withdraw.'

  return (
    <div className="yv-widget__cooldown-status">
      <p>Cooldown status</p>
      <span>
        Shares in cooldown: {formatWidgetValue(state.shares, shareToken.decimals)} {shareToken.symbol}
      </span>
      <span>
        Estimated assets in cooldown: {formatWidgetValue(assets, assetToken.decimals)} {assetToken.symbol}
      </span>
      <span>
        Available to withdraw now: {formatWidgetValue(state.availableWithdrawLimit, assetToken.decimals)}{' '}
        {assetToken.symbol}
      </span>
      <span>{remaining}</span>
    </div>
  )
}

export function ActivityPanel({
  availableBalance,
  availableToken,
  config,
  depositedValue,
  depositedValueDecimals,
  depositedValueUsd,
  onConnectWallet,
  onViewAllActivity,
  positionSources,
  TransactionLink
}: ActivityPanelProps): ReactElement {
  const { address } = useAccount()
  const wagmiConfig = useConfig()
  const publicClient = usePublicClient({ chainId: config.chainId })
  const [activeTab, setActiveTab] = useState<WalletTab>('balances')
  const tabListId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const services = useVaultWidgetServices()
  const relatedAddresses = useMemo(() => getVaultWidgetRelatedAddresses(config), [config])
  const activityQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'activity', address],
    queryFn: () => services.activityStore.list(address),
    enabled: !!address,
    refetchInterval: 15_000
  })
  const activities = useMemo(
    () =>
      address
        ? filterVaultWidgetActivities(activityQuery.data ?? [], {
            account: address,
            chainId: config.chainId,
            relatedAddresses
          })
        : [],
    [activityQuery.data, address, config.chainId, relatedAddresses]
  )
  const recentActivities = activities.slice(0, 3)
  const pendingActivities = activities.filter(({ status }) => status === 'pending' || status === 'submitted')
  const pendingKey = pendingActivities
    .map(
      ({ id, hash, isFinalTransaction, proposalId, status }) =>
        `${id}:${status}:${hash ?? ''}:${proposalId ?? ''}:${isFinalTransaction === true ? 'final' : 'intermediate'}`
    )
    .join(',')
  useQuery({
    queryKey: ['vault-widget', config.id, 'activity-reconciliation', address, pendingKey],
    queryFn: async () => {
      await Promise.all(
        pendingActivities.map(async (activity) => {
          if (activity.id === undefined) return
          const update = await reconcileVaultWidgetActivity({
            activity,
            config: wagmiConfig,
            ensoBridge: services.ensoBridge,
            execution: services.execution
          })
          if (update) await updateVaultWidgetActivitySafely(services.activityStore, activity.id, update)
        })
      )
      await activityQuery.refetch()
      return true
    },
    enabled: pendingActivities.length > 0,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY
  })
  const cooldownSource = config.info?.cooldownVaultAddress
    ? positionSources.find(({ token }) => isAddressEqual(token.address, config.info!.cooldownVaultAddress!))
    : undefined
  const cooldownQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'wallet-cooldown', address],
    queryFn: async () => {
      if (!address || !publicClient || !config.info?.cooldownVaultAddress) {
        throw new Error('Cooldown status is unavailable')
      }
      const state = await readVaultWidgetCooldownState({
        account: address,
        publicClient,
        vaultAddress: config.info.cooldownVaultAddress
      })
      const assets = cooldownSource?.readValue
        ? await cooldownSource.readValue(publicClient, state.shares)
        : state.availableWithdrawLimit
      return { assets, state }
    },
    enabled: !!address && !!publicClient && !!config.info?.cooldownVaultAddress,
    refetchInterval: 30_000
  })
  const activeSources =
    config.info?.showAllPositionSources === true
      ? positionSources
      : positionSources.filter(({ balance }) => balance > 0n)
  const visibleSources = activeSources.length > 0 ? activeSources : positionSources.slice(0, 1)
  const showTotalShares =
    config.info?.showTotalShares !== false &&
    visibleSources.length > 1 &&
    visibleSources.every(({ balance }) => balance > 0n)
  const depositedToken = config.depositTokens[0] ?? availableToken
  const depositedPriceUsd = config.display?.assetPriceUsd ?? 0
  const availableUsd = Number(formatUnits(availableBalance, availableToken.decimals)) * (availableToken.priceUsd ?? 0)

  const selectTab = (tab: WalletTab, focus = false): void => {
    setActiveTab(tab)
    if (focus) {
      const index = WALLET_TABS.findIndex(({ id }) => id === tab)
      tabRefs.current[index]?.focus()
    }
  }
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const nextIndex = getNextWalletTabIndex(event.key, index, WALLET_TABS.length)
    if (nextIndex === undefined) return
    event.preventDefault()
    selectTab(WALLET_TABS[nextIndex]!.id, true)
  }

  return (
    <div className="yv-widget__wallet">
      <div className="yv-widget__wallet-header">
        <h3>Wallet</h3>
        <div className="yv-widget__wallet-tabs" role="tablist" aria-label="Wallet information" id={tabListId}>
          {WALLET_TABS.map((tab, index) => (
            <button
              aria-controls={`${tabListId}-${tab.id}`}
              aria-selected={activeTab === tab.id}
              data-active={activeTab === tab.id}
              id={`${tabListId}-${tab.id}-tab`}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {pendingActivities.length > 0 ? (
        <button className="yv-widget__pending-activity" type="button" onClick={() => selectTab('transactions', true)}>
          <span className="yv-widget__spinner" aria-hidden="true" />
          {pendingActivities.length === 1
            ? '1 transaction is still pending.'
            : `${pendingActivities.length} transactions are still pending.`}
        </button>
      ) : null}

      {!address ? (
        <div className="yv-widget__wallet-empty">
          <WalletIcon />
          <p>Connect a wallet to view balances and transactions.</p>
          <button type="button" onClick={() => onConnectWallet?.()}>
            Connect Wallet
          </button>
        </div>
      ) : activeTab === 'balances' ? (
        <div
          aria-labelledby={`${tabListId}-balances-tab`}
          className="yv-widget__wallet-content"
          id={`${tabListId}-balances`}
          role="tabpanel"
        >
          <section className="yv-widget__wallet-balances">
            <h4>Your Vault balances</h4>
            <dl>
              <div>
                <dt>Deposited value</dt>
                <dd>
                  {formatWidgetValue(depositedValue, depositedValueDecimals)} {depositedToken.symbol}
                  <small>({depositedValueUsd})</small>
                </dd>
              </div>
              {visibleSources.map((source) => (
                <div key={source.id}>
                  <dt>{getPositionLabel(source)}</dt>
                  <dd>
                    {formatWidgetValue(source.balance, source.token.decimals)} {getPositionUnit(source)}
                    <small>
                      ({formatUsd(Number(formatUnits(source.value, depositedValueDecimals)) * depositedPriceUsd)})
                    </small>
                  </dd>
                </div>
              ))}
              {showTotalShares ? (
                <div>
                  <dt>Total shares</dt>
                  <dd>
                    {formatWidgetValue(
                      visibleSources.reduce((total, { balance }) => total + balance, 0n),
                      visibleSources[0]!.token.decimals
                    )}{' '}
                    vault shares
                    <small>({depositedValueUsd})</small>
                  </dd>
                </div>
              ) : null}
            </dl>
            {cooldownQuery.data && cooldownSource ? (
              <CooldownStatus
                assetToken={depositedToken}
                assets={cooldownQuery.data.assets}
                shareToken={cooldownSource.token}
                state={cooldownQuery.data.state}
              />
            ) : null}
          </section>

          <section className="yv-widget__wallet-balances">
            <h4>Wallet balances</h4>
            <dl>
              <div>
                <dt>Available {availableToken.symbol}</dt>
                <dd>
                  {formatWidgetValue(availableBalance, availableToken.decimals)} {availableToken.symbol}
                  <small>({formatUsd(availableUsd)})</small>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      ) : (
        <section
          aria-labelledby={`${tabListId}-transactions-tab`}
          className="yv-widget__wallet-transactions"
          id={`${tabListId}-transactions`}
          role="tabpanel"
        >
          <div className="yv-widget__wallet-section-heading">
            <h4>Recent transactions</h4>
            {onViewAllActivity ? (
              <button type="button" onClick={onViewAllActivity}>
                All activity
              </button>
            ) : null}
          </div>
          {activityQuery.isLoading ? (
            <div className="yv-widget__skeleton" aria-label="Loading activity" />
          ) : activityQuery.error ? (
            <div className="yv-widget__notice yv-widget__notice--error" role="alert">
              Unable to load wallet activity.
            </div>
          ) : recentActivities.length === 0 ? (
            <p className="yv-widget__empty">No recent transactions.</p>
          ) : (
            <ol className="yv-widget__activity-list">
              {recentActivities.map((activity) => (
                <ActivityRow
                  activity={activity}
                  config={config}
                  key={activity.id ?? `${activity.timestamp}:${activity.type}`}
                  TransactionLink={TransactionLink}
                />
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
