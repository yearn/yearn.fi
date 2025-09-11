import type { ReactElement } from 'react'

export function IconShare({ stroke = 'currentColor', ...props }: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg {...props} width={'12'} height={'12'} viewBox={'0 0 12 12'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
      <path d={'M5 1H11V7'} stroke={stroke} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
      <path d={'M11 1L1 11'} stroke={stroke} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
    </svg>
  )
}
