'use client'

import NumberFlow from '@number-flow/react'
import type { TLifetimeEarningsHeadline } from '@shared/utils/schemas/lifetimeEarningsSchema'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'

// Tick at the whole-dollar cadence (1000 / rate ms) so each update rolls the
// last digit by ~$1, clamped for sane rates. The roll animation runs linear
// with duration matched to the tick so each roll finishes exactly as the next
// value lands — constant velocity, no rubber-band.
const TICK_MIN_MS = 50
const TICK_MAX_MS = 1_000

export function LifetimeEarningsStat({ headline }: { headline: TLifetimeEarningsHeadline }): ReactElement {
  const [value, setValue] = useState(headline.value)

  const tickMs = Math.min(TICK_MAX_MS, Math.max(TICK_MIN_MS, 1_000 / headline.rate_usd_per_sec))

  // Timer-driven extrapolation between server reads: the figure must advance
  // on wall-clock time, which has no declarative alternative.
  useEffect(() => {
    const extrapolate = (): number =>
      headline.value + (headline.rate_usd_per_sec * (Date.now() - headline.computed_at_ms)) / 1000

    setValue(extrapolate())
    const timer = window.setInterval(() => setValue(extrapolate()), tickMs)
    return () => window.clearInterval(timer)
  }, [headline, tickMs])

  return (
    <div className={'flex max-w-full flex-col items-center gap-1'}>
      <p className={'text-2xl sm:text-[28px] text-white text-center'}>
        <span className={'font-number mr-2 opacity-75'}>{'$'}</span>
        <NumberFlow
          className={'font-number'}
          value={value}
          format={{ maximumFractionDigits: 0 }}
          trend={1}
          transformTiming={{ duration: tickMs, easing: 'linear' }}
          spinTiming={{ duration: tickMs, easing: 'linear' }}
          willChange
        />
      </p>
      <p className={'text-xs sm:text-sm text-white opacity-75'}>{'Lifetime earned by Yearn Vaults'}</p>
    </div>
  )
}
