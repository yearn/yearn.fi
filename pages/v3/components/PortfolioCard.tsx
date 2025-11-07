import Link from '@components/Link'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { cl, formatAmount, toAddress } from '@lib/utils'
import { formatPercent } from '@lib/utils/format'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

type TFeaturedVaultConfig = {
  symbol: string
  icon: string
  href: string
  address: string
}

type TFeaturedVaultRow = TFeaturedVaultConfig & {
  apr: number | null
}

type THoldingDisplayRow = {
  id: string
  symbol: string
  name: string
  icon: string
  href: string
  valueUSD: number
}

type PortfolioCardProps = {
  holdingsVaults: TYDaemonVault[]
  className?: string
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
})

const FEATURED_VAULTS: TFeaturedVaultConfig[] = [
  {
    symbol: 'ETH',
    icon: '/landing/vaults/eth.png',
    href: '/v3/1/0xAc37729B76db6438CE62042AE1270ee574CA7571',
    address: '0xAc37729B76db6438CE62042AE1270ee574CA7571'
  },
  {
    symbol: 'USDS',
    icon: '/landing/vaults/usds.png',
    href: '/v3/1/0x182863131F9a4630fF9E27830d945B1413e347E8',
    address: '0x182863131F9a4630fF9E27830d945B1413e347E8'
  },
  {
    symbol: 'USDC',
    icon: '/landing/vaults/usdc.png',
    href: '/v3/1/0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
    address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'
  },
  {
    symbol: 'crvUSD',
    icon: '/landing/vaults/crvusd.png',
    href: '/v3/1/0xBF319dDC2Edc1Eb6FDf9910E39b37Be221C8805F',
    address: '0xBF319dDC2Edc1Eb6FDf9910E39b37Be221C8805F'
  }
]

function useFeaturedVaultRows(): {
  rows: TFeaturedVaultRow[]
  isLoading: boolean
} {
  const { vaults, isLoadingVaultList } = useYearn()

  const rows = useMemo(() => {
    return FEATURED_VAULTS.map((vault) => {
      const vaultData = vaults?.[vault.address]
      if (!vaultData) {
        return { ...vault, apr: null }
      }

      const forward = vaultData.apr.forwardAPR?.netAPR ?? 0
      const extra = vaultData.apr.extra?.stakingRewardsAPR ?? 0
      const totalApr = extra > 0 ? forward + extra : forward

      return { ...vault, apr: totalApr > 0 ? totalApr : null }
    })
  }, [vaults])

  return { rows, isLoading: isLoadingVaultList }
}

export function PortfolioCard({ holdingsVaults, className }: PortfolioCardProps): ReactElement {
  const { cumulatedValueInV3Vaults, isLoading, getBalance } = useWallet()
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()
  const { getPrice } = useYearn()
  const { rows: featuredRows, isLoading: isFeaturedLoading } = useFeaturedVaultRows()
  const holdingRows = useMemo(() => {
    return holdingsVaults
      .map((vault) => {
        const shareBalance = getBalance({
          address: vault.address,
          chainID: vault.chainID
        })
        const price = getPrice({
          address: vault.address,
          chainID: vault.chainID
        })
        const baseValue = shareBalance.normalized * price.normalized

        let stakingValue = 0
        if (vault.staking?.available && vault.staking.address) {
          const stakingBalance = getBalance({
            address: vault.staking.address,
            chainID: vault.chainID
          })
          stakingValue = stakingBalance.normalized * price.normalized
        }

        const totalValue = baseValue + stakingValue
        const iconSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${toAddress(
          vault.token.address
        ).toLowerCase()}/logo-128.png`

        return {
          id: `${vault.chainID}-${toAddress(vault.address)}`,
          symbol: vault.token.symbol || vault.symbol,
          name: vault.name,
          icon: iconSrc,
          href: `/v3/${vault.chainID}/${vault.address}`,
          valueUSD: totalValue
        }
      })
      .filter((entry) => entry.valueUSD > 0)
      .sort((a, b) => b.valueUSD - a.valueUSD)
  }, [getBalance, getPrice, holdingsVaults])

  const hasDisplayHoldings = holdingRows.length > 0
  const shouldShowFeaturedVaults = !isActive || !hasDisplayHoldings
  const featuredSection = shouldShowFeaturedVaults ? (
    <FeaturedVaultsPreview isLoading={isFeaturedLoading} rows={featuredRows} />
  ) : null

  const handleConnect = (): void => {
    if (!isActive && address) {
      onSwitchChain(1)
      return
    }
    openLoginModal()
  }

  if (!isActive) {
    return (
      <div
        className={cl(
          'flex h-full w-full flex-col justify-center gap-6 rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
          'md:p-8',
          className
        )}
      >
        <PortfolioCtaRow
          message={"Connect a wallet to see your deposits and interact with Yearn's smart contracts."}
          action={
            <button
              className={cl(
                'group relative min-w-[200px] inline-flex items-center justify-center overflow-hidden rounded-lg px-12 py-3',
                'border-none text-sm font-semibold text-white'
              )}
              onClick={handleConnect}
              type={'button'}
            >
              <div
                className={cl(
                  'absolute inset-0',
                  'pointer-events-none opacity-80 transition-opacity group-hover:opacity-100',
                  'bg-[linear-gradient(80deg,#D21162,#2C3DA6)]'
                )}
              />
              <span className={'relative z-10'}>{'Connect wallet'}</span>
            </button>
          }
          actionPosition={'left'}
        />
        {featuredSection ? <div className={'w-full'}>{featuredSection}</div> : null}
      </div>
    )
  }

  if (isActive && !hasDisplayHoldings) {
    return (
      <div
        className={cl(
          'flex h-full w-full flex-col justify-center gap-6 rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
          'md:p-8',
          className
        )}
      >
        <PortfolioCtaRow
          message={"We couldn't find any Yearn deposits for this wallet yet."}
          action={
            <Link
              className={cl(
                'inline-flex items-center justify-center rounded-lg border border-white/60 px-8 py-2',
                'text-sm font-semibold text-white transition hover:border-white hover:text-white'
              )}
              href={'/v3'}
            >
              {'Explore vaults'}
            </Link>
          }
        />
        <div className={'flex flex-col gap-4'}>
          <FeaturedVaultsPreview isLoading={isFeaturedLoading} rows={featuredRows} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cl(
        'flex h-full w-full flex-col rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
        'md:p-8',
        className
      )}
    >
      <strong className={'block pb-2 text-3xl font-black text-white md:pb-4 md:text-4xl md:leading-[48px]'}>
        {'Your Portfolio'}
      </strong>
      <div className={'flex flex-col gap-6 md:flex-row md:items-end md:gap-14'}>
        <div>
          <p className={'pb-1 text-sm uppercase tracking-[0.35em] text-white/60'}>{'Deposited'}</p>
          {isLoading ? (
            <div className={'h-[36.5px] w-32 animate-pulse rounded-sm bg-white/20'} />
          ) : (
            <b className={'font-number text-3xl text-white md:text-4xl'}>
              {'$'}
              <span suppressHydrationWarning>{formatAmount(cumulatedValueInV3Vaults.toFixed(2), 2, 2)}</span>
            </b>
          )}
        </div>
      </div>
      {hasDisplayHoldings ? (
        <div className={'mt-6'}>
          <HoldingsList rows={holdingRows} />
        </div>
      ) : (
        <div className={'mt-6 flex flex-col gap-4'}>
          <p className={'text-sm text-white/70'}>{'We didn’t find any Yearn deposits for this wallet yet.'}</p>
          {featuredSection}
        </div>
      )}
    </div>
  )
}

function FeaturedVaultsPreview({ rows, isLoading }: { rows: TFeaturedVaultRow[]; isLoading: boolean }): ReactElement {
  return (
    <div className={'w-full'}>
      <div className={'flex flex-col gap-px rounded-2xl bg-white/10 p-px'}>
        {isLoading
          ? rows.map((row) => (
              <div
                key={row.address}
                className={
                  'flex h-12 items-center justify-between rounded-2xl bg-white/5 px-4 first:rounded-t-2xl last:rounded-b-2xl'
                }
              >
                <div className={'flex items-center gap-3'}>
                  <div className={'size-8 rounded-full bg-white/10'} />
                  <div className={'flex flex-col'}>
                    <span className={'text-sm font-semibold text-white'}>{row.symbol}</span>
                    <span className={'text-xs text-white/60'}>{'Fetching APY…'}</span>
                  </div>
                </div>
                <div className={'h-4 w-16 rounded-full bg-white/10'} />
              </div>
            ))
          : rows.map((row, index) => {
              return (
                <Link
                  key={row.address}
                  className={cl(
                    'flex items-center justify-between bg-[#0F1B4F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#152566]',
                    index === 0 ? 'rounded-t-2xl' : '',
                    index === rows.length - 1 ? 'rounded-b-2xl' : ''
                  )}
                  href={row.href}
                >
                  <div className={'flex items-center gap-3'}>
                    <div className={'rounded-2xl p-1'}>
                      <div className={'flex size-8 items-center justify-center rounded-2xl bg-white/10'}>
                        <img
                          alt={`${row.symbol} icon`}
                          className={'size-6 rounded-full object-contain'}
                          src={row.icon}
                        />
                      </div>
                    </div>
                    <span>
                      {row.apr !== null
                        ? `Earn up to ${formatPercent(row.apr * 100, 2, 2)} on ${row.symbol}`
                        : `Earn on ${row.symbol}`}
                    </span>
                  </div>
                  <span className={'text-white/70'}>
                    <svg
                      xmlns={'http://www.w3.org/2000/svg'}
                      className={'size-5'}
                      fill={'none'}
                      viewBox={'0 0 24 24'}
                      stroke={'currentColor'}
                    >
                      <path
                        strokeLinecap={'round'}
                        strokeLinejoin={'round'}
                        strokeWidth={2}
                        d={'M14 5l7 7m0 0l-7 7m7-7H3'}
                      />
                    </svg>
                  </span>
                </Link>
              )
            })}
      </div>
    </div>
  )
}

function PortfolioCtaRow({
  message,
  action,
  actionPosition = 'right'
}: {
  message: string
  action: ReactElement
  actionPosition?: 'left' | 'right'
}): ReactElement {
  const isActionLeft = actionPosition === 'left'

  return (
    <div
      className={
        'flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:justify-between md:gap-6 md:text-left'
      }
    >
      <p
        className={cl(
          'flex min-h-[48px] items-center text-sm text-white/70 md:mt-1 md:min-h-[52px] md:text-base',
          isActionLeft ? 'md:order-2' : 'md:order-1'
        )}
      >
        {message}
      </p>
      <div
        className={cl(
          'flex w-full justify-center md:w-auto',
          isActionLeft ? 'md:order-1 md:justify-start' : 'md:order-2 md:justify-end'
        )}
      >
        {action}
      </div>
    </div>
  )
}

function HoldingsList({ rows }: { rows: THoldingDisplayRow[] }): ReactElement | null {
  if (rows.length === 0) {
    return null
  }

  return (
    <div className={'flex flex-col gap-px rounded-2xl bg-white/10 p-px'}>
      {rows.map((row, index) => (
        <Link
          key={row.id}
          className={cl(
            'flex items-center justify-between bg-[#0F1B4F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#152566]',
            index === 0 ? 'rounded-t-2xl' : '',
            index === rows.length - 1 ? 'rounded-b-2xl' : ''
          )}
          href={row.href}
        >
          <div className={'flex items-center gap-3'}>
            <div className={'rounded-2xl p-1'}>
              <div className={'flex size-8 items-center justify-center rounded-2xl bg-white/10'}>
                <img alt={`${row.symbol} icon`} className={'size-6 rounded-full object-contain'} src={row.icon} />
              </div>
            </div>
            <div className={'flex flex-col'}>
              <span>{row.name}</span>
              <span className={'text-xs text-white/60'}>{row.symbol}</span>
            </div>
          </div>
          <span className={'text-base font-semibold'}>{currencyFormatter.format(row.valueUSD)}</span>
        </Link>
      ))}
    </div>
  )
}
