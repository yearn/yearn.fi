import { Button } from '@shared/components/Button'
import { EmptyState } from '@shared/components/EmptyState'
import type { ReactElement } from 'react'
import { Link } from 'react-router'

type TEmptySectionCardProps = {
  title: string
  description: string
  ctaLabel: string
  ctaClassName?: string
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never })

export function EmptySectionCard({
  title,
  description,
  ctaLabel,
  ctaClassName,
  onClick,
  href
}: TEmptySectionCardProps): ReactElement {
  const actionButton = href ? (
    <Link to={href} className={ctaClassName ?? 'yearn--button min-h-[44px] px-6'} data-variant="filled">
      {ctaLabel}
    </Link>
  ) : (
    <Button onClick={onClick} variant="filled" className={ctaClassName ?? 'min-h-[44px] px-6'}>
      {ctaLabel}
    </Button>
  )

  return <EmptyState title={title} description={description} action={actionButton} />
}
