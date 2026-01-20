import type React from 'react'
import type { ReactElement } from 'react'

export function IconVolatile(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg width={24} height={24} viewBox={'0 0 24 24'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'} {...props}>
      <path
        d={'M3.5 14.5L8 10L12 14L16 8L20.5 12.5'}
        stroke={'currentColor'}
        strokeWidth={1.5}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      />
      <path d={'M3.5 18.5H20.5'} stroke={'currentColor'} strokeWidth={1.5} strokeLinecap={'round'} />
    </svg>
  )
}
