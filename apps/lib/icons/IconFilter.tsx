import type { ReactElement } from 'react'

export function IconFilter(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg {...props} width={'24'} height={'24'} viewBox={'0 0 24 24'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
      <path
        d={'M22 3H2L10 12.46V19L14 21V12.46L22 3Z'}
        stroke={'currentColor'}
        strokeWidth={'2'}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      />
    </svg>
  )
}
