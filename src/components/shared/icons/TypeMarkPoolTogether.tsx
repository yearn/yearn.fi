import type { ReactElement, SVGProps } from 'react'

export function TypeMarkPoolTogether(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox={'0 0 300 85'} fill={'none'} {...props}>
      <image href={'/pooltogether.svg'} width={'300'} height={'85'} preserveAspectRatio={'xMidYMid meet'} />
    </svg>
  )
}
