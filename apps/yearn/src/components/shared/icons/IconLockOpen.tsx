import type { ReactElement } from 'react'

type TProps = {
  className?: string
  size?: number
}

export function IconLockOpen({ className, size = 16 }: TProps): ReactElement {
  return (
    // biome-ignore lint/performance/noImgElement: icon component wraps a static SVG asset and must stay server-safe.
    <img
      src="/lock-open-white2.svg"
      alt=""
      width={size}
      height={size}
      className={`${className || ''} aspect-square object-contain`}
      aria-hidden="true"
    />
  )
}
