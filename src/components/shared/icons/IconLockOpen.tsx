import type { ReactElement } from 'react'

type TProps = {
  className?: string
  size?: number
}

export function IconLockOpen({ className, size = 16 }: TProps): ReactElement {
  return (
    <img
      src="/lock-open-white2.svg"
      alt=""
      width={size}
      height={size}
      className={`${className || ''} aspect-square object-cover`}
      aria-hidden="true"
    />
  )
}
