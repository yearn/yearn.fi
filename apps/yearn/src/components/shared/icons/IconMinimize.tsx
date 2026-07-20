import type { ReactElement } from 'react'

export function IconMinimize(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg {...props} width={'12'} height={'13'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
      <path
        d={
          'M6 5.625a.5.5 0 0 0 .5.5H11a.5.5 0 0 0 0-1H7v-4a.5.5 0 0 0-1 0v4.5Zm3.5-3-.354-.354-3 3 .354.354.354.354 3-3-.354-.354ZM5.5 7.375a.5.5 0 0 0-.5-.5H.5a.5.5 0 1 0 0 1h4v4a.5.5 0 1 0 1 0v-4.5Zm-3.5 3 .354.354 3-3L5 7.375l-.354-.354-3 3 .354.354Z'
        }
        fill={'#fff'}
        fillOpacity={'.75'}
      />
    </svg>
  )
}
