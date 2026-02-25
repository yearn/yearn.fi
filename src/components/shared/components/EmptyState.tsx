import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'

type TEmptyStateSize = 'sm' | 'md' | 'lg'

type TEmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  size?: TEmptyStateSize
  className?: string
  unstyled?: boolean
}

const SIZE_CLASSES: Record<TEmptyStateSize, { container: string; title: string; description: string }> = {
  sm: {
    container: 'gap-2 px-4 py-8',
    title: 'text-sm font-medium',
    description: 'text-xs text-text-secondary'
  },
  md: {
    container: 'gap-4 px-4 py-12 sm:px-6 sm:py-16',
    title: 'text-base font-semibold sm:text-lg',
    description: 'text-sm text-text-secondary'
  },
  lg: {
    container: 'gap-2 px-10 py-2',
    title: 'text-lg font-normal',
    description: 'text-neutral-600'
  }
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  size = 'md',
  className,
  unstyled = false
}: TEmptyStateProps): ReactElement {
  const sizeClasses = SIZE_CLASSES[size]

  return (
    <div className={cl({ 'rounded-lg border border-border bg-surface': !unstyled }, className)}>
      <div className={cl('flex h-full flex-col items-center justify-center text-center', sizeClasses.container)}>
        {icon && <div className="text-text-secondary">{icon}</div>}
        <p className={cl('text-text-primary', sizeClasses.title)}>{title}</p>
        {description && <p className={cl('max-w-md', sizeClasses.description)}>{description}</p>}
        {action}
      </div>
    </div>
  )
}
