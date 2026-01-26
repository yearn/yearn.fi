import type React from 'react'
import type { ReactElement } from 'react'

export function IconPendle(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg width={29} height={36} viewBox={'0 0 29 36'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'} {...props}>
      <circle cx={7.70625} cy={27.5339} r={7.70625} fill={'currentColor'} />
      <mask id={'pendle-mask'} maskUnits={'userSpaceOnUse'} x={6} y={1} width={3} height={21}>
        <path
          fillRule={'evenodd'}
          clipRule={'evenodd'}
          d={'M6.85858 21.6685L6.85859 1.01562L8.57646 1.01562L8.57646 21.6685L6.85858 21.6685Z'}
          fill={'white'}
        />
      </mask>
      <g mask={'url(#pendle-mask)'}>
        <path
          d={
            'M28.016 14.2291C28.016 21.9655 21.7445 28.237 14.0081 28.237C6.27174 28.237 0.000183105 21.9655 0.000183105 14.2291C0.000183105 6.49275 6.27174 0.221191 14.0081 0.221191C21.7445 0.221191 28.016 6.49275 28.016 14.2291Z'
          }
          fill={'currentColor'}
        />
      </g>
      <circle cx={14.008} cy={14.0079} r={14.0079} fill={'currentColor'} fillOpacity={0.5} />
    </svg>
  )
}
