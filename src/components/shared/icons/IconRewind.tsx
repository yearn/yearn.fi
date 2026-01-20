import type React from 'react'
import type { ReactElement } from 'react'

export function IconRewind(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      xmlns={'http://www.w3.org/2000/svg'}
      width={24}
      height={24}
      viewBox={'0 0 24 24'}
      fill={'none'}
      stroke={'currentColor'}
      strokeWidth={2}
      strokeLinecap={'round'}
      strokeLinejoin={'round'}
      {...props}
    >
      <path d={'M12 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 12 18z'} />
      <path d={'M22 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 22 18z'} />
    </svg>
  )
}
