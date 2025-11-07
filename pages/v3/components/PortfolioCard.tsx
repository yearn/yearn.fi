import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { cl, formatAmount } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import HoldingsMarquee from '@vaults-v3/components/list/HoldingsMarquee'
import type { ReactElement } from 'react'

type PortfolioCardProps = {
  holdingsVaults: TYDaemonVault[]
  className?: string
}

export function PortfolioCard({ holdingsVaults, className }: PortfolioCardProps): ReactElement {
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
