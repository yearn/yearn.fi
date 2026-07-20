import type React from 'react'
import type { ReactElement } from 'react'

export function IconPendle(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg width={29} height={36} viewBox={'0 0 29 36'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'} {...props}>
      <circle cx={14.008} cy={14.0079} r={14.0079} fill={'currentColor'} className={'text-text-tertiary'} />
      <circle cx={7.70625} cy={27.5339} r={7.70625} fill={'currentColor'} className={'text-text-primary'} />
      <path
        fillRule={'evenodd'}
        clipRule={'evenodd'}
        d={'M6.85858 21.6685L6.85859 1.01562L8.57646 1.01562L8.57646 21.6685L6.85858 21.6685Z'}
        fill={'currentColor'}
        className={'text-text-primary'}
      />
    </svg>
  )
}
