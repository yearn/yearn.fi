import type { ReactElement } from 'react'

export function IconMoon(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2'} {...props}>
      <path d={'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'} />
    </svg>
  )
}
