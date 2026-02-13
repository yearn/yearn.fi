import type { ReactElement, SVGProps } from 'react'

export function TypeMarkCurve(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox={'0 0 175 48'} fill={'none'} {...props}>
      <image href={'/Curve.svg'} width={'175'} height={'48'} preserveAspectRatio={'xMidYMid meet'} />
    </svg>
  )
}
