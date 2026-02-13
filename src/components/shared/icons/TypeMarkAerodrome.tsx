import type { ReactElement, SVGProps } from 'react'

export function TypeMarkAerodrome(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox={'0 0 401 56'} fill={'none'} {...props}>
      <image href={'/aerodrome-typemark.svg'} width={'401'} height={'56'} preserveAspectRatio={'xMidYMid meet'} />
    </svg>
  )
}
