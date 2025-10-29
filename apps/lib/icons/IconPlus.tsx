import type { ReactElement } from 'react'

export function IconPlus(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg {...props} width={'14'} height={'14'} viewBox={'0 0 14 14'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
      <path d={'M7 1V13'} stroke={'currentColor'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
      <path d={'M1 7H13'} stroke={'currentColor'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
    </svg>
  )
}
