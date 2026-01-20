import type { ReactElement } from 'react'

export function IconScissors(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg {...props} width={'24'} height={'24'} viewBox={'0 0 24 24'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
      <circle cx={'6'} cy={'6'} r={'3'} stroke={'currentColor'} strokeWidth={'2'} />
      <path
        d={'M8.12 8.12 12 12'}
        stroke={'currentColor'}
        strokeWidth={'2'}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      />
      <path
        d={'M20 4 8.12 15.88'}
        stroke={'currentColor'}
        strokeWidth={'2'}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      />
      <circle cx={'6'} cy={'18'} r={'3'} stroke={'currentColor'} strokeWidth={'2'} />
      <path
        d={'M14.8 14.8 20 20'}
        stroke={'currentColor'}
        strokeWidth={'2'}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      />
    </svg>
  )
}
