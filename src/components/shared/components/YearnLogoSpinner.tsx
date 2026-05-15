import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

type TYearnLogoSpinnerProps = {
  className?: string
  logoClassName?: string
}

export function YearnLogoSpinner({ className, logoClassName }: TYearnLogoSpinnerProps): ReactElement {
  return (
    <div className={cl('relative flex h-12 w-12 items-center justify-center', className)}>
      <div className={'absolute inset-0 animate-spin rounded-full border-2 border-border border-t-primary'} />
      <img
        src={'/logo.svg'}
        alt={''}
        width={32}
        height={32}
        className={cl('z-10 size-8', logoClassName)}
        aria-hidden={'true'}
      />
    </div>
  )
}
