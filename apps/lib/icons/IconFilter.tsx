import type { ReactElement } from 'react'

export function IconFilter(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg {...props} width={'24'} height={'24'} viewBox={'0 0 24 24'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
      <path d={'M2 5H22'} stroke={'currentColor'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
      <path d={'M6 12H18'} stroke={'currentColor'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
      <path d={'M9 19H15'} stroke={'currentColor'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
    </svg>
  )
}
