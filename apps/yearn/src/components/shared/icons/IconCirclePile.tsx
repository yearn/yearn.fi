import type React from 'react'
import type { ReactElement } from 'react'

export function IconCirclePile(props: React.SVGProps<SVGSVGElement>): ReactElement {
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
      <circle cx={12} cy={19} r={2} />
      <circle cx={12} cy={5} r={2} />
      <circle cx={16} cy={12} r={2} />
      <circle cx={20} cy={19} r={2} />
      <circle cx={4} cy={19} r={2} />
      <circle cx={8} cy={12} r={2} />
    </svg>
  )
}
