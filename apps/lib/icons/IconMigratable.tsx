import type React from 'react'
import type { ReactElement } from 'react'

export function IconMigratable(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      xmlns={'http://www.w3.org/2000/svg'}
      width={24}
      height={24}
      viewBox={'0 0 24 24'}
      fill={'none'}
      stroke={'currentColor'}
      strokeWidth={2}
      strokeLinecap={'round'}
      strokeLinejoin={'round'}
      {...props}
    >
      <path d={'M3 5v14'} />
      <path d={'M21 12H7'} />
      <path d={'m15 18 6-6-6-6'} />
    </svg>
  )
}
