import type { TTranchedProductKind } from '@pages/vaults/constants/tranchedProducts'
import type { ReactElement } from 'react'
import { env } from '@/env'

type TTranchedVaultBannerProps = {
  kind: TTranchedProductKind
  onExploreStructure: () => void
}

export function TranchedVaultBanner({ kind, onExploreStructure }: TTranchedVaultBannerProps): ReactElement {
  const label = kind === 'senior' ? 'Senior' : 'Junior'
  return (
    <aside
      aria-label={`${label} tranche banner`}
      className={
        'flex min-h-[72px] w-full items-center overflow-hidden rounded-lg border border-border bg-[#f8f8f9] px-5 py-2 text-[#0675f9] md:px-8'
      }
      style={{
        backgroundImage: `url(${env.BASE_URL || '/'}ytranche/${kind}-banner.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className={'space-y-1'}>
        <p className={'text-2xl font-bold leading-none md:text-[28px]'}>{`${label}, by Yearn.`}</p>
        <button
          type={'button'}
          onClick={onExploreStructure}
          className={
            'text-left text-sm font-bold leading-tight underline underline-offset-4 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4'
          }
        >
          {'Explore the structure'}
        </button>
      </div>
    </aside>
  )
}
