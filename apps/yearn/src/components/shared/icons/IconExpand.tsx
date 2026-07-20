import type { ReactElement } from 'react'

export function IconExpand(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg {...props} width={'10'} height={'9'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
      <path
        d={
          'M.5 8.5A.5.5 0 0 0 1 9h4.5a.5.5 0 0 0 0-1h-4V4a.5.5 0 0 0-1 0v4.5Zm3.5-3-.354-.354-3 3L1 8.5l.354.354 3-3L4 5.5ZM9.5.5A.5.5 0 0 0 9 0H4.5a.5.5 0 0 0 0 1h4v4a.5.5 0 0 0 1 0V.5ZM6 3.5l.354.354 3-3L9 .5 8.646.146l-3 3L6 3.5Z'
        }
        fill={'#fff'}
        fillOpacity={'.75'}
      />
    </svg>
  )
}
