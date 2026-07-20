'use client'

import type { TPortfolioProtocolPosition } from '@pages/portfolio/types/position'
import { VaultsListChip } from '@pages/vaults/components/list/VaultsListChip'
import { TokenLogo } from '@shared/components/TokenLogo'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { cl, formatAmount, formatApyDisplay, formatTvlDisplay, toNormalizedValue } from '@shared/utils'
import type { ReactElement } from 'react'
import { env } from '@/env'

const ETHEREUM_CHAIN_ID = 1

type TProtocolPositionRowProps = {
  position: TPortfolioProtocolPosition
}

function getTokenLogoSrc(tokenAddress: string): string {
  return `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${ETHEREUM_CHAIN_ID}/${tokenAddress.toLowerCase()}/logo-32.png`
}

function formatTokenAmount(value: number, maximumFractionDigits = 4): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0'
  }

  if (value < 0.0001) {
    return '< 0.0001'
  }

  return formatAmount(value, 0, maximumFractionDigits)
}

function formatDate(timestampSeconds: number | undefined): string | null {
  if (!timestampSeconds) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(timestampSeconds * 1000))
}

function getStatusItems(position: TPortfolioProtocolPosition): string[] {
  const formatRaw = (value: bigint): string => formatTokenAmount(toNormalizedValue(value, position.decimals))
  const items: string[] = []

  if (position.walletRaw > 0n) {
    items.push(`Wallet ${formatRaw(position.walletRaw)}`)
  }
  if (position.activeRaw > 0n) {
    items.push(`Active ${formatRaw(position.activeRaw)}`)
  }
  if (position.cooldownRaw > 0n) {
    items.push(`Cooldown ${formatRaw(position.cooldownRaw)}`)
  }
  if (position.withdrawableRaw > 0n) {
    items.push(`Withdrawable ${formatRaw(position.withdrawableRaw)}`)
  }
  if (position.unlockTime) {
    const unlockDate = formatDate(position.unlockTime)
    if (unlockDate) {
      items.push(`Unlocks ${unlockDate}`)
    }
  }
  if (position.boostMultiplier && position.boostMultiplier > 0) {
    items.push(`${formatAmount(position.boostMultiplier, 1, 2)}x boost`)
  }

  return items
}

export function ProtocolPositionRow({ position }: TProtocolPositionRowProps): ReactElement {
  const tokenLogoSrc = getTokenLogoSrc(position.tokenAddress)
  const chainLogoSrc = `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/chains/${ETHEREUM_CHAIN_ID}/logo-32.png`
  const cooldownEndsAt = formatDate(position.cooldown?.endsAt)
  const statusItems = getStatusItems(position)
  const apyDisplay = position.apy === null ? '-' : formatApyDisplay(position.apy)
  const tvlDisplay = position.tvlUsd > 0 ? formatTvlDisplay(position.tvlUsd) : '-'
  return (
    <div className="w-full overflow-hidden bg-surface transition-colors max-md:border-b-1 max-md:border-border">
      <a
        href={position.href}
        target="_blank"
        rel="noreferrer"
        className={cl(
          'group relative grid w-full grid-cols-1 bg-surface',
          'p-4 pb-4 md:grid-cols-24 md:p-6 md:py-4 md:pr-20'
        )}
      >
        <div
          className={cl(
            'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-100',
            'group-hover:opacity-20 group-focus-visible:opacity-20',
            'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
          )}
        />
        <div className="z-10 col-span-12 flex flex-col items-start sm:pt-0 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full gap-6 overflow-visible border-b border-border pb-2 md:border-none md:pb-0">
            <div className="relative flex size-10 min-h-10 min-w-10 items-center justify-center self-center">
              <TokenLogo src={tokenLogoSrc} tokenSymbol={position.symbol} width={40} height={40} />
              <div className="absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border border-border bg-surface">
                <TokenLogo src={chainLogoSrc} tokenSymbol="Ethereum" width={16} height={16} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <strong
                  title={position.name}
                  className="block truncate-safe whitespace-nowrap font-black text-lg leading-tight text-text-primary"
                >
                  {position.name}
                </strong>
                <IconLinkOut className="size-3 shrink-0 text-text-secondary" aria-hidden={true} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-primary/70">
                <VaultsListChip
                  label="Ethereum"
                  icon={<TokenLogo src={chainLogoSrc} tokenSymbol="Ethereum" width={14} height={14} />}
                />
                <VaultsListChip label={position.symbol} />
                {position.cooldownRaw > 0n ? (
                  <VaultsListChip
                    label="Cooldown"
                    tooltipDescription={cooldownEndsAt ? `Cooldown ends ${cooldownEndsAt}` : 'Cooldown in progress'}
                  />
                ) : null}
                {position.withdrawableRaw > 0n ? <VaultsListChip label="Withdrawable" /> : null}
              </div>
            </div>
          </div>
          <div className="mt-2 flex w-full flex-col gap-2 md:hidden">
            <div className="grid w-full grid-cols-2 gap-2 text-sm text-text-secondary">
              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                <span className="text-text-primary/60">{'Est. APY:'}</span>
                <span className="text-lg font-semibold text-text-primary">{apyDisplay}</span>
              </div>
              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                <span className="text-text-primary/60">{'Holdings:'}</span>
                <span className="text-lg font-semibold text-text-primary">{formatTvlDisplay(position.valueUsd)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="z-10 mt-4 hidden gap-4 md:col-span-12 md:mt-0 md:grid md:grid-cols-12 md:items-center">
          <div className="yearn--table-data-section-item col-span-4" datatype="number">
            <div className="flex justify-end text-right">
              <span className="yearn--table-data-section-item-value font-semibold text-text-primary">{apyDisplay}</span>
            </div>
          </div>
          <div className="yearn--table-data-section-item col-span-4" datatype="number">
            <div className="flex justify-end text-right">
              <span className="yearn--table-data-section-item-value font-semibold text-text-primary">{tvlDisplay}</span>
            </div>
          </div>
          <div className="yearn--table-data-section-item col-span-4" datatype="number">
            <div className="flex justify-end text-right">
              <span className="yearn--table-data-section-item-value font-semibold text-text-primary">
                {formatTvlDisplay(position.valueUsd)}
              </span>
            </div>
          </div>
        </div>
        {statusItems.length > 0 ? <span className="sr-only">{statusItems.join(', ')}</span> : null}
      </a>
    </div>
  )
}
