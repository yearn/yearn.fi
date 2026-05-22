import { Button } from '@shared/components/Button'
import { EmptyState } from '@shared/components/EmptyState'
import Link from 'next/link'
import type { ReactElement } from 'react'

type TEmptySectionCardProps = {
  title: string
  description?: string
  ctaLabel: string
  ctaClassName?: string
  secondaryCtaClassName?: string
  secondaryCtaHref?: string
  secondaryCtaLabel?: string
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never })

export function EmptySectionCard({
  title,
  description,
  ctaLabel,
  ctaClassName,
  secondaryCtaClassName,
  secondaryCtaHref,
  secondaryCtaLabel,
  onClick,
  href
}: TEmptySectionCardProps): ReactElement {
  const actionButton = href ? (
    <Link href={href} className={ctaClassName ?? 'yearn--button min-h-[44px] px-6'} data-variant="filled">
      {ctaLabel}
    </Link>
  ) : (
    <Button onClick={onClick} variant="filled" className={ctaClassName ?? 'min-h-[44px] px-6'}>
      {ctaLabel}
    </Button>
  )
  const secondaryActionButton =
    secondaryCtaHref && secondaryCtaLabel ? (
      <Link
        href={secondaryCtaHref}
        className={
          secondaryCtaClassName ??
          'flex min-h-[44px] items-center justify-center rounded-lg border border-text-primary bg-surface px-6 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-secondary'
        }
      >
        {secondaryCtaLabel}
      </Link>
    ) : null
  const action = secondaryActionButton ? (
    <div className="flex items-center justify-center gap-2">
      {actionButton}
      {secondaryActionButton}
    </div>
  ) : (
    actionButton
  )

  return <EmptyState title={title} description={description} action={action} />
}
