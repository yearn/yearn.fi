import type { ReactElement } from 'react'

export function IconArrowLeft(props: React.SVGProps<SVGSVGElement>): ReactElement {
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
      <line x1={'19'} y1={'12'} x2={'5'} y2={'12'} />
      <polyline points={'12 19 5 12 12 5'} />
    </svg>
  )
}
