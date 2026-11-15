import { type TTranchedProduct, YVUSD_JUNIOR_COOLDOWN_DAYS } from '@pages/vaults/constants/tranchedProducts'
import type { ReactElement } from 'react'
import { env } from '@/env'

type TTranchedVaultBannerProps = Pick<TTranchedProduct, 'apyLabel' | 'asset' | 'kind' | 'name'>

export function TranchedVaultBanner({ apyLabel, asset, kind, name }: TTranchedVaultBannerProps): ReactElement {
  const isSenior = kind === 'senior'
  const label = isSenior ? 'Senior' : 'Junior'
  const heading = isSenior && asset === 'USD' ? 'Still yvUSD, now Senior.' : `Meet ${name}${isSenior ? ' Senior' : ''}.`
  const cooldownDays = asset === 'USD' ? YVUSD_JUNIOR_COOLDOWN_DAYS : 14
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
        <p className={'text-2xl font-bold leading-none md:text-[28px]'}>{heading}</p>
        <p className="text-sm font-bold leading-tight">
          {isSenior
            ? `A ${apyLabel.replace('.00%', '%')} target APY with no withdrawal cooldown`
            : `Higher yield potential with a ${cooldownDays}-day withdrawal cooldown`}
        </p>
      </div>
    </aside>
  )
}
