import { Button } from '@shared/components/Button'
import type { ReactElement } from 'react'
import { Link } from 'react-router'

type TEmptySectionCardProps = {
  title: string
  description: string
  ctaLabel: string
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never })

export function EmptySectionCard({
  title,
  description,
  ctaLabel,
  onClick,
  href
}: TEmptySectionCardProps): ReactElement {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center sm:px-6 sm:py-16">
        <p className="text-base font-semibold text-text-primary sm:text-lg">{title}</p>
        <p className="max-w-md text-sm text-text-secondary">{description}</p>
        {href ? (
          <Link to={href} className="yearn--button min-h-[44px] px-6" data-variant="filled">
            {ctaLabel}
          </Link>
        ) : (
          <Button onClick={onClick} variant="filled" className="min-h-[44px] px-6">
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
