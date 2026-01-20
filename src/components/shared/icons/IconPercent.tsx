import type React from 'react'
import type { ReactElement } from 'react'

export function IconPercent(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg width={24} height={24} viewBox={'0 0 24 24'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'} {...props}>
      <line x1={19} y1={5} x2={5} y2={19} stroke={'currentColor'} strokeWidth={2} strokeLinecap={'round'} />
      <circle cx={6.5} cy={6.5} r={2.5} stroke={'currentColor'} strokeWidth={2} />
      <circle cx={17.5} cy={17.5} r={2.5} stroke={'currentColor'} strokeWidth={2} />
    </svg>
  )
}
