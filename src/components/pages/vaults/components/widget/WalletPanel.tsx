import {
  getVaultDecimals,
  getVaultSymbol,
  getVaultTVL,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultUserData, type VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { isYvUsdVault, YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { IconCheck } from '@shared/icons/IconCheck'
import { IconCross } from '@shared/icons/IconCross'
import { IconLoader } from '@shared/icons/IconLoader'
import { IconWallet } from '@shared/icons/IconWallet'
import type { TToken } from '@shared/types'
import type { TNotification, TNotificationStatus } from '@shared/types/notifications'
import {
  cl,
  formatTAmount,
  formatUSD,
  SELECTOR_BAR_STYLES,
  toAddress,
  toNormalizedBN,
  truncateHex
} from '@shared/utils'
import { getVaultName } from '@shared/utils/helpers'
import { getNetwork } from '@shared/utils/wagmi/utils'
import { type FC, type ReactElement, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

type WalletPanelProps = {
  isActive: boolean
  currentVault: TKongVaultInput
  vaultAddress: `0x${string}`
  stakingAddress?: `0x${string}`
  chainId: number
  vaultUserData: VaultUserData
  onSelectZapToken?: (token: TToken) => void
}

const WALLET_TABS = [
  { id: 'balances', label: 'Balances' },
  { id: 'transactions', label: 'Transactions' }
] as const

type WalletTabKey = (typeof WALLET_TABS)[number]['id']

const STATUS_STYLES: Record<TNotificationStatus, { label: string; className: string; icon: ReactElement }> = {
  success: { label: 'Success', className: 'bg-[#00796D] text-white', icon: <IconCheck className="size-3" /> },
  submitted: { label: 'Submitted', className: 'bg-[#2563EB] text-white', icon: <IconCheck className="size-3" /> },
  pending: {
    label: 'Pending',
    className: 'bg-surface-tertiary text-text-primary',
    icon: <IconLoader className="size-3 animate-spin" />
  },
  error: { label: 'Error', className: 'bg-[#C73203] text-white', icon: <IconCross className="size-3" /> }
}

function YvUsdVaultBalances({ account }: { account?: `0x${string}` }): ReactElement {
  const { getPrice } = useYearn()
  const { unlockedVault, lockedVault, isLoading: isLoadingYvUsd } = useYvUsdVaults()

  const unlockedAssetAddress = toAddress(unlockedVault?.token.address ?? YVUSD_UNLOCKED_ADDRESS)
  const unlockedUserData = useVaultUserData({
    vaultAddress: toAddress(unlockedVault?.address ?? YVUSD_UNLOCKED_ADDRESS),
    assetAddress: unlockedAssetAddress,
    chainId: YVUSD_CHAIN_ID,
    account
  })
  const lockedUserData = useVaultUserData({
    vaultAddress: toAddress(lockedVault?.address ?? YVUSD_LOCKED_ADDRESS),
    assetAddress: YVUSD_UNLOCKED_ADDRESS,
    chainId: YVUSD_CHAIN_ID,
    account
  })

  const unlockedSymbol = unlockedUserData.assetToken?.symbol ?? 'USDC'
  const lockedSymbol = lockedUserData.assetToken?.symbol ?? 'yvUSD'
  const unlockedDecimals = unlockedUserData.assetToken?.decimals ?? 6
  const lockedDecimals = lockedUserData.assetToken?.decimals ?? 18
  const unlockedPrice =
    unlockedUserData.assetToken?.address && unlockedUserData.assetToken?.chainID
      ? getPrice({
          address: toAddress(unlockedUserData.assetToken.address),
          chainID: unlockedUserData.assetToken.chainID
        }).normalized
      : 0
  const lockedPrice = getPrice({ address: YVUSD_UNLOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).normalized || unlockedPrice
  const unlockedNormalized = toNormalizedBN(unlockedUserData.depositedValue, unlockedDecimals).normalized
  const lockedNormalized = toNormalizedBN(lockedUserData.depositedValue, lockedDecimals).normalized
  const unlockedUsd = unlockedNormalized * unlockedPrice
  const lockedUsd = lockedNormalized * lockedPrice
  const totalUsd = unlockedUsd + lockedUsd

  if (isLoadingYvUsd || unlockedUserData.isLoading || lockedUserData.isLoading) {
    return <p className="text-text-secondary">{'Loading yvUSD position data...'}</p>
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <span className="text-text-secondary">Deposited value</span>
        <span className="text-text-primary text-base font-semibold">{formatUSD(totalUsd)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-text-secondary">Unlocked position</span>
        <span className="text-text-primary text-base font-semibold">
          {`${formatTAmount({ value: unlockedUserData.depositedValue, decimals: unlockedDecimals })} ${unlockedSymbol}`}
          <span className="ml-1 text-xs text-text-secondary font-medium">({formatUSD(unlockedUsd)})</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-text-secondary">Locked position</span>
        <span className="text-text-primary text-base font-semibold">
          {`${formatTAmount({ value: lockedUserData.depositedValue, decimals: lockedDecimals })} ${lockedSymbol}`}
          <span className="ml-1 text-xs text-text-secondary font-medium">({formatUSD(lockedUsd)})</span>
        </span>
      </div>
    </>
  )
}

export const WalletPanel: FC<WalletPanelProps> = ({
  isActive: isPanelActive,
  currentVault,
  vaultAddress,
  stakingAddress,
  chainId,
  vaultUserData,
  onSelectZapToken
}) => {
  const { address, isActive: isWalletActive, openLoginModal } = useWeb3()
  const { cachedEntries } = useNotifications()
  const navigate = useNavigate()
  const { balances } = useWallet()
  const { getPrice } = useYearn()
  const [activeTab, setActiveTab] = useState<WalletTabKey>('balances')
  const { assetToken, vaultToken, stakingToken, depositedValue, depositedShares, pricePerShare, isLoading } =
    vaultUserData
  const isYvUsd = isYvUsdVault(currentVault)
  const vaultDecimals = getVaultDecimals(currentVault)
  const vaultTVL = getVaultTVL(currentVault)

  const assetSymbol = assetToken?.symbol || getVaultSymbol(currentVault)
  const vaultSymbol = vaultToken?.symbol || getVaultSymbol(currentVault) || assetSymbol
  const stakingSymbol = stakingToken?.symbol
  const depositedUnderlying = toNormalizedBN(depositedValue, assetToken?.decimals ?? vaultDecimals).normalized
  const depositedUsd = depositedUnderlying * (vaultTVL.price || 0)
  const availableBalance = assetToken?.balance.raw ?? 0n
  const vaultBalance = vaultToken?.balance.raw ?? 0n
  const stakingBalance = stakingToken?.balance.raw ?? 0n
  const hasVaultShares = vaultBalance > 0n
  const hasStakedShares = stakingBalance > 0n
  const showTotalShares = hasVaultShares && hasStakedShares
  const vaultName = getVaultName(currentVault)
  const assetPrice = assetToken?.address
    ? getPrice({ address: toAddress(assetToken.address), chainID: assetToken.chainID ?? chainId }).normalized
    : 0
  const assetDecimals = assetToken?.decimals ?? vaultDecimals
  const shareTokenDecimals = vaultToken?.decimals ?? 18
  const maxShareLabelLength = 'vault shares'.length
  const baseVaultSharesLabel = vaultSymbol || 'vault shares'
  const baseStakedSharesLabel = stakingSymbol || baseVaultSharesLabel
  const vaultSharesLabel = baseVaultSharesLabel.length > maxShareLabelLength ? 'vault shares' : baseVaultSharesLabel
  const stakedSharesLabel = baseStakedSharesLabel.length > maxShareLabelLength ? 'vault shares' : baseStakedSharesLabel

  const formatTokenAmount = useCallback(
    (
      value: bigint | number,
      decimals: number,
      symbol?: string,
      options?: {
        minimumFractionDigits?: number
        maximumFractionDigits?: number
        displayDigits?: number
        shouldDisplaySymbol?: boolean
        shouldCompactValue?: boolean
      }
    ): string => {
      const amount = formatTAmount({
        value,
        decimals,
        symbol: '',
        options: { ...options, shouldDisplaySymbol: false }
      })
      return symbol ? `${amount} ${symbol}` : amount
    },
    []
  )

  const depositedLabel = formatTokenAmount(depositedValue, assetDecimals, assetSymbol)
  const vaultBalanceLabel = formatTokenAmount(vaultBalance, shareTokenDecimals, vaultSharesLabel, {
    shouldCompactValue: true
  })
  const stakingBalanceLabel = formatTokenAmount(stakingBalance, shareTokenDecimals, stakedSharesLabel, {
    shouldCompactValue: true
  })
  const totalSharesLabel = formatTokenAmount(depositedShares, shareTokenDecimals, vaultSharesLabel, {
    shouldCompactValue: true
  })
  const availableLabel = formatTokenAmount(availableBalance, assetDecimals, assetSymbol, { shouldCompactValue: true })

  const vaultSharesUsd = useMemo(() => {
    if (!pricePerShare || vaultBalance === 0n || assetPrice === 0) return 0
    const underlying = (vaultBalance * pricePerShare) / 10n ** BigInt(shareTokenDecimals)
    const normalized = toNormalizedBN(underlying, assetDecimals).normalized
    return normalized * assetPrice
  }, [pricePerShare, vaultBalance, shareTokenDecimals, assetDecimals, assetPrice])

  const stakedSharesUsd = useMemo(() => {
    if (!pricePerShare || stakingBalance === 0n || assetPrice === 0) return 0
    const underlying = (stakingBalance * pricePerShare) / 10n ** BigInt(shareTokenDecimals)
    const normalized = toNormalizedBN(underlying, assetDecimals).normalized
    return normalized * assetPrice
  }, [pricePerShare, stakingBalance, shareTokenDecimals, assetDecimals, assetPrice])

  const totalSharesUsd = vaultSharesUsd + stakedSharesUsd
  const availableUsd = (assetToken?.balance.normalized ?? 0) * assetPrice

  const relatedAddresses = useMemo(() => {
    const addresses = [vaultAddress, stakingAddress].filter(Boolean) as `0x${string}`[]
    return addresses.map((addr) => toAddress(addr).toLowerCase())
  }, [vaultAddress, stakingAddress])

  const recentEntries = useMemo(() => {
    const filtered = (
      address ? cachedEntries.filter((entry) => entry.address.toLowerCase() === address.toLowerCase()) : cachedEntries
    ).filter((entry) => {
      const entryFrom = entry.fromAddress ? toAddress(entry.fromAddress).toLowerCase() : undefined
      const entryTo = entry.toAddress ? toAddress(entry.toAddress).toLowerCase() : undefined
      const hasRelatedAddress = relatedAddresses.some((related) => related === entryFrom || related === entryTo)
      const chainMatches = entry.chainId === chainId || entry.toChainId === chainId
      return hasRelatedAddress && chainMatches
    })

    return filtered.toReversed().slice(0, 3)
  }, [address, cachedEntries, relatedAddresses, chainId])

  const zapTokens = useMemo(() => {
    const chainBalances = balances[chainId] || {}
    const excluded = [vaultAddress, stakingAddress].filter(Boolean).map((addr) => toAddress(addr).toLowerCase())
    const tokens = Object.values(chainBalances).filter((token) => {
      if (!token?.address) return false
      if (token.balance.raw <= 0n) return false
      return !excluded.includes(toAddress(token.address).toLowerCase())
    }) as TToken[]

    const sorted = tokens.toSorted((a, b) => {
      const aBalance = a.balance?.raw || 0n
      const bBalance = b.balance?.raw || 0n
      return bBalance > aBalance ? 1 : -1
    })
    return sorted.map((token) => {
      const tokenPrice = getPrice({ address: toAddress(token.address), chainID: token.chainID }).normalized
      const tokenUsd = token.balance.normalized * tokenPrice
      return {
        token,
        amountLabel: formatTokenAmount(token.balance.raw, token.decimals, token.symbol, { shouldCompactValue: true }),
        usdLabel: formatUSD(tokenUsd)
      }
    })
  }, [balances, chainId, vaultAddress, stakingAddress, getPrice, formatTokenAmount])

  return (
    <div
      className={cl(
        'bg-app rounded-b-lg overflow-hidden relative w-full min-w-0 flex-1 min-h-0 max-h-full',
        isPanelActive ? 'flex flex-col' : 'hidden'
      )}
      aria-hidden={!isPanelActive}
      data-tour="vault-detail-wallet-panel"
    >
      <div className="bg-surface border border-border rounded-lg flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between gap-3 px-6 py-3">
          <h3 className="text-base font-semibold text-text-primary">Wallet</h3>
          <div className="flex items-center justify-end ml-auto">
            <div className={cl('flex items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}>
              {WALLET_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cl(
                    'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold transition-all',
                    'min-h-[36px] md:min-h-0 active:scale-[0.98] whitespace-nowrap',
                    SELECTOR_BAR_STYLES.buttonBase,
                    activeTab === tab.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 max-h-full p-6 pt-3" data-scroll-priority>
          <div className="space-y-6">
            {!isWalletActive || !address ? (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-8">
                <IconWallet className="size-6 text-text-secondary" />
                <p className="text-sm text-text-secondary">Connect a wallet to view balances and transactions.</p>
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="rounded-lg bg-text-primary px-4 py-2 text-xs font-semibold text-surface transition-colors hover:opacity-90"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <>
                {activeTab === 'balances' ? (
                  <>
                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold text-text-primary">Your Vault balances</h4>
                      <div className="space-y-2 text-sm">
                        {isYvUsd ? (
                          <YvUsdVaultBalances account={address ? toAddress(address) : undefined} />
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-text-secondary">Deposited value</span>
                              <div className="text-right">
                                <span className="text-text-primary text-base font-semibold">{depositedLabel}</span>
                                <span className="text-xs text-text-secondary ml-1 font-medium">
                                  ({formatUSD(depositedUsd)})
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-text-secondary ">
                                {hasStakedShares && !showTotalShares ? 'Staked shares' : 'Deposited shares'}
                              </span>
                              <span className="text-text-primary text-base font-semibold">
                                {hasStakedShares && !showTotalShares ? stakingBalanceLabel : vaultBalanceLabel}
                                <span className="ml-1 text-xs text-text-secondary font-medium">
                                  ({formatUSD(hasStakedShares && !showTotalShares ? stakedSharesUsd : vaultSharesUsd)})
                                </span>
                              </span>
                            </div>
                            {showTotalShares ? (
                              <>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-text-secondary">Staked shares</span>
                                  <span className="text-text-primary text-base font-semibold">
                                    {stakingBalanceLabel}
                                    <span className="ml-1 text-xs text-text-secondary font-medium">
                                      ({formatUSD(stakedSharesUsd)})
                                    </span>
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-text-secondary">Total shares</span>
                                  <span className="text-text-primary font-semibold">
                                    {totalSharesLabel}
                                    <span className="ml-1 text-xs text-text-secondary font-medium">
                                      ({formatUSD(totalSharesUsd)})
                                    </span>
                                  </span>
                                </div>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold text-text-primary">Wallet balances</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-text-secondary">Available {assetSymbol}</span>
                          <span className="text-text-primary text-base font-semibold">
                            {availableLabel}
                            <span className="ml-1 text-xs text-text-secondary font-medium">
                              ({formatUSD(availableUsd)})
                            </span>
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold text-text-primary">Zap-ready tokens</h4>
                      {zapTokens.length === 0 ? (
                        <div className="text-xs text-text-secondary">No wallet tokens available to zap.</div>
                      ) : (
                        <div className="space-y-2">
                          {zapTokens.map(({ token, amountLabel, usdLabel }) => (
                            <button
                              key={`${token.chainID}-${token.address}`}
                              type="button"
                              onClick={() => onSelectZapToken?.(token)}
                              className="group relative flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary px-3 py-2 transition-colors hover:bg-surface"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <TokenLogo
                                  src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${token.chainID}/${token.address.toLowerCase()}/logo-32.png`}
                                  tokenSymbol={token.symbol}
                                  tokenName={token.name}
                                  width={20}
                                  height={20}
                                  className="rounded-full"
                                />
                                <div className="min-w-0 text-left">
                                  <div className="text-sm font-semibold text-text-primary">{token.symbol}</div>
                                  <div className="text-[10px] text-text-secondary truncate">{token.name}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-text-primary">{amountLabel}</div>
                                <div className="text-[10px] text-text-secondary font-medium">({usdLabel})</div>
                              </div>
                              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                deposit into {vaultName}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                ) : null}

                {activeTab === 'transactions' ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-sm font-semibold text-text-primary">Recent transactions</h4>
                      <button
                        type="button"
                        onClick={() => navigate('/portfolio?tab=activity')}
                        className="rounded-md border border-border bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                      >
                        All activity
                      </button>
                    </div>
                    {isLoading ? (
                      <div className="text-xs text-text-secondary">Loading balances…</div>
                    ) : recentEntries.length === 0 ? (
                      <div className="text-xs text-text-secondary">No recent transactions.</div>
                    ) : (
                      <div className="space-y-2">
                        {recentEntries.map((entry) => (
                          <RecentTransactionRow key={entry.id ?? `${entry.type}-${entry.txHash}`} entry={entry} />
                        ))}
                      </div>
                    )}
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecentTransactionRow({ entry }: { entry: TNotification }): ReactElement {
  const explorerBaseURI = getNetwork(entry.chainId).defaultBlockExplorer
  const statusMeta = STATUS_STYLES[entry.status]
  const baseAmount = entry.fromTokenName ? entry.amount.replace(entry.fromTokenName, '').trim() : entry.amount
  const amountLabel =
    entry.fromTokenName && baseAmount
      ? `${baseAmount} ${entry.fromTokenName}`
      : entry.amount || entry.fromTokenName || ''

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-text-primary capitalize">{entry.type}</div>
        <div className="text-xs text-text-secondary truncate">{amountLabel}</div>
        {entry.txHash && explorerBaseURI ? (
          <a
            href={`${explorerBaseURI}/tx/${entry.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-text-secondary hover:text-text-primary"
          >
            {truncateHex(entry.txHash, 4)}
          </a>
        ) : null}
      </div>
      <div className={cl('flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', statusMeta.className)}>
        {statusMeta.icon}
        {statusMeta.label}
      </div>
    </div>
  )
}
