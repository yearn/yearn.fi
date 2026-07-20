import type { ReactElement } from 'react'

export function IconPower(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox={'0 0 24 24'}
      fill={'none'}
      stroke={'currentColor'}
      strokeWidth={'2'}
      strokeLinecap={'round'}
      strokeLinejoin={'round'}
      {...props}
    >
      <path d={'M18.36 6.64a9 9 0 1 1-12.73 0'} />
      <line x1={'12'} y1={'2'} x2={'12'} y2={'12'} />
    </svg>
  )
}
