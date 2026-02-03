import type React from 'react'
import type { ReactElement } from 'react'

export function IconStack(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg width={24} height={24} viewBox={'0 0 24 24'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'} {...props}>
      <path d={'M4 8L12 4L20 8L12 12L4 8Z'} stroke={'currentColor'} strokeWidth={1.5} strokeLinejoin={'round'} />
      <path d={'M4 12L12 16L20 12'} stroke={'currentColor'} strokeWidth={1.5} strokeLinejoin={'round'} />
      <path d={'M4 16L12 20L20 16'} stroke={'currentColor'} strokeWidth={1.5} strokeLinejoin={'round'} />
    </svg>
  )
}
