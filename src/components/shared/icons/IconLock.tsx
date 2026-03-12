import type { ReactElement } from 'react'

type TProps = {
  className?: string
  size?: number
}

export function IconLock({ className, size = 16 }: TProps): ReactElement {
  return <img src="/lock-closed-white.svg" alt="" width={size} height={size} className={className} aria-hidden="true" />
}
