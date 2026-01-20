import Link from '@components/Link'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

type TBreadcrumbItem = {
  label: string
  href?: string
  isCurrent?: boolean
}

type TBreadcrumbsProps = {
  items: TBreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: TBreadcrumbsProps): ReactElement {
  const lastIndex = items.length - 1

  return (
    <nav aria-label={'Breadcrumb'} className={cl('flex items-center gap-2 text-sm text-text-secondary', className)}>
      {items.map((item, index) => {
        const isCurrent = item.isCurrent ?? index === lastIndex
        const content =
          item.href && !isCurrent ? (
            <Link to={item.href} className={'transition-colors hover:text-text-primary'}>
              {item.label}
            </Link>
          ) : (
            <span
              className={isCurrent ? 'font-medium text-text-primary' : undefined}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {item.label}
            </span>
          )

        return (
          <span key={`${item.label}-${index}`} className={'flex items-center gap-2'}>
            {content}
            {index < lastIndex ? <span>{'>'}</span> : null}
          </span>
        )
      })}
    </nav>
  )
}
