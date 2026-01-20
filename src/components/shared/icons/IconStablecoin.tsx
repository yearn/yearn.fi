import type React from 'react'
import type { ReactElement } from 'react'

export function IconStablecoin(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg width={24} height={24} viewBox={'0 0 24 24'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'} {...props}>
      <circle cx={12} cy={12} r={9} stroke={'currentColor'} strokeWidth={1.5} />
      <path
        d={'M8 12.5L10.5 15L16 9.5'}
        stroke={'currentColor'}
        strokeWidth={1.5}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      />
    </svg>
  )
}
