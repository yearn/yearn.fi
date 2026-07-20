import type { TTranchedProductKind } from '@pages/vaults/constants/tranchedProducts'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

type TTranchedProductsListProps = {
  kind: TTranchedProductKind
  className?: string
}

const KIND_COPY: Record<TTranchedProductKind, { title: string; eyebrow: string; body: string }> = {
  senior: {
    eyebrow: 'Steady Yield',
    title: 'Risk-remote vaults with targeted rates.',
    body: 'Steady Yield products receive their target coupon first and losses are first marked from the junior and reserve vaults that sit below them.'
  },
  junior: {
    eyebrow: 'Single Asset',
    title: 'Levered yield, junior position',
    body: 'Levered products receive the excess return after steady-yield obligations are covered. Any losses are marked from these vaults before the steady yield products.'
  }
}

export function TranchedProductsList({ kind, className }: TTranchedProductsListProps): ReactElement {
  const copy = KIND_COPY[kind]

  return (
    <section className={cl('w-full rounded-lg border border-border bg-surface p-4 md:p-5', className)}>
      <p className={'text-xs font-semibold uppercase text-text-secondary'}>{copy.eyebrow}</p>
      <div className={'mt-1'}>
        <h2 className={'text-xl font-black text-text-primary'}>{copy.title}</h2>
        <p className={'mt-1 text-sm leading-6 text-text-secondary'}>{copy.body}</p>
      </div>
    </section>
  )
}
