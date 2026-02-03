import type { ReactElement } from 'react'

export function LogoYearnMark(props: React.SVGProps<SVGSVGElement> & { color?: string }): ReactElement {
  const { color = 'currentColor', ...svgProps } = props

  return (
    <svg
      xmlns={'http://www.w3.org/2000/svg'}
      xmlnsXlink={'http://www.w3.org/1999/xlink'}
      viewBox={'0 0 215 256.1'}
      role={'img'}
      {...svgProps}
    >
      <g transform={'translate(6 6) scale(0.95)'}>
        <path
          fill={color}
          d={
            'M201.9,98.5l-32.4,32.4c1.8,5.9,2.7,12.2,2.7,18.5c0,17.1-6.7,33.2-18.7,45.3c-12.1,12.1-28.2,18.7-45.3,18.7s-33.2-6.7-45.3-18.7c-12.1-12.1-18.7-28.2-18.7-45.3c0-6.4,0.9-12.6,2.7-18.5L14.4,98.5c-8.2,15.1-12.9,32.5-12.9,51c0,58.9,47.8,106.7,106.7,106.7s106.7-47.8,106.7-106.7C214.9,131,210.2,113.6,201.9,98.5z'
          }
        />
        <polygon
          fill={color}
          points={'86.8,170.7 129.5,170.7 129.5,102.9 202.2,30.2 172,0 108.2,63.8 44.4,0 14.2,30.2 86.8,102.8'}
        />
      </g>
    </svg>
  )
}
