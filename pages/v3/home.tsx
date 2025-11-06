import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import { cl, formatAmount } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import HoldingsMarquee from '@vaults-v3/components/list/HoldingsMarquee'
import { V3Mask } from '@vaults-v3/Mark'
import type { ReactElement } from 'react'

function Background(): ReactElement {
  return (
    <div className={cl('absolute inset-0', 'pointer-events-none', 'bg-gradient-to-r from-[#D21162] to-[#2C3DA6]')} />
  )
}

function BrandNewVaultCard({ className }: { className?: string }): ReactElement {
  return (
    <div
      className={cl(
        'relative flex h-full w-full min-w-0 overflow-hidden rounded-3xl',
        'px-4 pb-6 pt-6 md:px-10 md:pb-10 md:pt-12',
        className
      )}
    >
      <div className={'relative z-10 flex w-full flex-col gap-4'}>
        <p className={'text-xs font-semibold uppercase tracking-[0.45em] text-white/70'}>{'Yearn v3'}</p>
        <h1
          className={cl(
            'font-black uppercase text-white',
            'text-[44px] leading-[46px] md:text-[56px] md:leading-[64px]'
          )}
        >
          {'A brave new\nworld for Yield'}
        </h1>
        <p className={'max-w-[520px] whitespace-break-spaces text-base text-white/80 md:text-lg'}>
          {'Automation, composability, and personal dashboards — Yearn v3 keeps your capital working across chains.'}
        </p>
        <div className={'flex flex-wrap gap-3'}>
          <a
            className={cl(
              'inline-flex items-center justify-center rounded-lg border border-white/60 px-6 py-2',
              'text-sm font-semibold text-white transition hover:border-white hover:text-white'
            )}
            href={'/v3'}
          >
            {'Enter app'}
          </a>
          <a
            className={cl(
              'inline-flex items-center justify-center rounded-lg bg-white px-6 py-2',
              'text-sm font-semibold text-[#020637] transition hover:bg-white/90'
            )}
            href={'https://docs.yearn.finance/'}
            target={'_blank'}
            rel={'noreferrer'}
          >
            {'Read docs'}
          </a>
        </div>
      </div>
      <Background />
    </div>
  )
}

function V3Card({ className }: { className?: string }): ReactElement {
  return (
    <div
      className={cl(
        'flex h-full w-full min-w-0 items-center justify-center rounded-3xl bg-neutral-200/80 p-4',
        'shadow-[0_12px_32px_rgba(4,8,32,0.45)] md:p-6',
        className
      )}
    >
      <div className={'flex h-full w-full flex-col items-center justify-center gap-y-4'}>
        <V3Mask className={'h-auto w-[86%]'} />
        <p className={'text-xs font-semibold uppercase tracking-[0.4em] text-white/70'}>{'Vaults across six chains'}</p>
      </div>
    </div>
  )
}

function V3SecondaryCard({ className }: { className?: string }): ReactElement {
  return (
    <div
      className={cl(
        'flex h-full w-full min-w-0 flex-col justify-center rounded-3xl border border-white/10 bg-[#0A1040]/80 p-6',
        'text-white shadow-[0_12px_32px_rgba(4,8,32,0.35)] md:p-8',
        className
      )}
    >
      <p className={'text-sm font-semibold uppercase tracking-[0.4em] text-white/60'}>{'Yearn v3'}</p>
      <h2 className={'mt-3 text-2xl font-bold uppercase'}>{'Personal dashboards'}</h2>
      <p className={'mt-3 text-sm text-white/70'}>
        {'Soon you’ll find curated highlights from v3 strategies, tailored to your wallet and preferred chains.'}
      </p>
    </div>
  )
}

function PortfolioCard({
  holdingsVaults,
  className
}: {
  holdingsVaults: TYDaemonVault[]
  className?: string
}): ReactElement {
  const { cumulatedValueInV3Vaults, isLoading } = useWallet()
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()
  const hasHoldings = holdingsVaults.length > 0

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
          'w-full h-full rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
          'md:p-8',
          className
        )}
      >
        <strong className={'block pb-2 text-3xl font-black text-white md:pb-4 md:text-4xl md:leading-[48px]'}>
          {'Portfolio'}
        </strong>
        <p className={'max-w-[360px] text-sm text-white/70 md:text-base'}>
          {'Connect a wallet to see your deposits, migration nudges, and net APY across Yearn v3.'}
        </p>
        <button
          className={cl(
            'group relative mt-8 inline-flex items-center justify-center overflow-hidden rounded-lg px-10 py-2',
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
      </div>
    )
  }

  return (
    <div
      className={cl(
        'w-full h-full rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
        'md:p-8',
        className
      )}
    >
      <strong className={'block pb-2 text-3xl font-black text-white md:pb-4 md:text-4xl md:leading-[48px]'}>
        {'Portfolio'}
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
        <p className={'max-w-[260px] text-sm text-white/70 md:text-base'}>
          {'Track net deposits across vaults and staking addresses, updated as strategies compound.'}
        </p>
      </div>
      {hasHoldings ? (
        <div className={'mt-6'}>
          <HoldingsMarquee holdingsVaults={holdingsVaults} />
        </div>
      ) : null}
    </div>
  )
}

function DiscoverCard({ className }: { className?: string }): ReactElement {
  return (
    <div
      className={cl(
        'w-full h-full rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
        'md:p-8',
        className
      )}
    >
      <strong className={'block pb-2 text-3xl font-black text-white md:pb-4 md:text-4xl md:leading-[48px]'}>
        {'Discover Yearn'}
      </strong>
      <p className={'pb-4 text-sm text-white/70 md:text-base'}>
        {'Navigate the ecosystem — vaults, docs, governance, and new strategy drops.'}
      </p>
      <div className={'grid gap-3'}>
        <a
          className={cl(
            'flex items-center justify-between rounded-2xl bg-[#0F1B4F] px-4 py-3',
            'text-sm font-semibold text-white transition hover:bg-[#152566]'
          )}
          href={'/v3'}
        >
          <span>{'Launch Yearn v3'}</span>
          <span className={'text-xs uppercase tracking-[0.35em] text-white/60'}>{'App'}</span>
        </a>
        <a
          className={cl(
            'flex items-center justify-between rounded-2xl bg-[#0F1B4F] px-4 py-3',
            'text-sm font-semibold text-white transition hover:bg-[#152566]'
          )}
          href={'/vaults'}
        >
          <span>{'Browse legacy vaults'}</span>
          <span className={'text-xs uppercase tracking-[0.35em] text-white/60'}>{'Vaults'}</span>
        </a>
        <a
          className={cl(
            'flex items-center justify-between rounded-2xl bg-[#0F1B4F] px-4 py-3',
            'text-sm font-semibold text-white transition hover:bg-[#152566]'
          )}
          href={'https://docs.yearn.finance/'}
          target={'_blank'}
          rel={'noreferrer'}
        >
          <span>{'Read the knowledge base'}</span>
          <span className={'text-xs uppercase tracking-[0.35em] text-white/60'}>{'Docs'}</span>
        </a>
        <a
          className={cl(
            'flex items-center justify-between rounded-2xl bg-[#0F1B4F] px-4 py-3',
            'text-sm font-semibold text-white transition hover:bg-[#152566]'
          )}
          href={'https://gov.yearn.finance/'}
          target={'_blank'}
          rel={'noreferrer'}
        >
          <span>{'Join governance discussions'}</span>
          <span className={'text-xs uppercase tracking-[0.35em] text-white/60'}>{'Forum'}</span>
        </a>
      </div>
    </div>
  )
}

function V3Home(): ReactElement {
  const { holdingsVaults } = useV3VaultFilter(null, null, '', null)

  return (
    <div className={'min-h-screen w-full bg-neutral-0'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <div
          className={
            'grid grid-cols-12 gap-4 overflow-x-hidden pt-12 md:max-h-[100vh] md:auto-rows-[minmax(0,1fr)] md:grid-cols-16 md:grid-rows-8 md:gap-6 md:pt-20 md:pb-6'
          }
        >
          <div className={'col-span-12 min-w-0 md:order-1 md:col-span-4 md:col-start-1 md:row-span-2 md:row-start-1'}>
            <V3Card className={'h-full'} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-2 md:col-span-4 md:col-start-1 md:row-span-2 md:row-start-3'}>
            <V3SecondaryCard className={'h-full'} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-3 md:col-span-12 md:col-start-5 md:row-span-4 md:row-start-1'}>
            <BrandNewVaultCard className={'h-full'} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-4 md:col-span-9 md:row-span-4 md:row-start-5'}>
            <PortfolioCard holdingsVaults={holdingsVaults} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-5 md:col-span-7 md:col-start-10 md:row-span-4 md:row-start-5'}>
            <DiscoverCard />
          </div>
        </div>
      </div>
    </div>
  )
}

export default V3Home
