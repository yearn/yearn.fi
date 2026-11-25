import type { ReactElement } from 'react'

export function LogoCuration(
  props: React.SVGProps<SVGSVGElement> & {
    back?: string
    front?: string
  }
): ReactElement {
  const { back = 'text-transparent', front = 'text-primary', ...svgProps } = props

  return (
    <svg
      width={'32'}
      height={'32'}
      viewBox={'0 0 32 32'}
      fill={'none'}
      xmlns={'http://www.w3.org/2000/svg'}
      {...svgProps}
    >
      <rect width={'32'} height={'32'} fill={'currentColor'} className={back} />
      <path
        fillRule={'evenodd'}
        clipRule={'evenodd'}
        d={
          'M18.2 7.91c-.86-.4-1.6-.63-2.5-.78-2.57-.43-5.21.25-7.27 1.86-.34.27-1.13 1.05-1.4 1.38-1.2 1.49-1.87 3.19-2 5.09-.08 1.14.07 2.28.45 3.39 1.1 3.23 3.92 5.56 7.36 6.07 1.32.19 2.73.09 4.04-.3.52-.15 1.29-.47 1.57-.63l.1-.06-1.39-1.36c-1.12-1.1-1.4-1.36-1.45-1.34-.4.11-.82.17-1.31.19-.96.03-1.74-.12-2.55-.49-1.58-.72-2.7-2.13-3.08-3.85-.07-.3-.07-.41-.07-1.06 0-.64 0-.77.07-1.05.38-1.71 1.44-3.05 3.02-3.81.71-.34 1.37-.5 2.22-.52.61-.02.98.02 1.46.13l.31.07 1.38-1.36c.76-.75 1.38-1.37 1.38-1.38 0-.01-.15-.09-.33-.17Z'
        }
        fill={'currentColor'}
        className={front}
      />
      <path
        d={
          'M28.11 15.99l-1.45 1.45s-2.54 2.5-2.54 2.5l-2.54 2.5-1.04-1.02c-.57-.56-1.04-1.03-1.04-1.03s1.74-1.74 2.96-2.94h-6.58v-2.91h6.58l-2.96-2.92 1.05-1.03 1.05-1.03 2.54 2.49s2.54 2.49 2.54 2.49l1.46 1.46'
        }
        fill={'currentColor'}
        className={front}
      />
    </svg>
  )
}
