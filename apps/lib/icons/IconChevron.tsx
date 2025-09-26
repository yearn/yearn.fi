import type { ReactElement } from 'react'

type TProps = {
  className?: string
  size?: number
  direction?: 'up' | 'down' | 'left' | 'right'
}

export function IconChevron({ className, size = 16, direction = 'down' }: TProps): ReactElement {
  const rotationMap = {
    up: '180deg',
    down: '0deg',
    left: '90deg',
    right: '-90deg'
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={'none'}
      xmlns={'http://www.w3.org/2000/svg'}
      style={{ transform: `rotate(${rotationMap[direction]})` }}
      className={className}
    >
      <path
        d={'M4 6L8 10L12 6'}
        stroke={'currentColor'}
        strokeWidth={'2'}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      />
    </svg>
  )
}
