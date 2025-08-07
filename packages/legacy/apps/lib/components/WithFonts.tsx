import { Source_Code_Pro } from 'next/font/google'
import localFont from 'next/font/local'
import type { ReactElement, ReactNode } from 'react'

const aeonik = localFont({
  variable: '--font-aeonik',
  display: 'swap',
  src: [
    {
      path: '../../../public/fonts/Aeonik-Light.ttf',
      weight: '300',
      style: 'normal'
    },
    {
      path: '../../../public/fonts/Aeonik-Regular.woff2',
      weight: '400',
      style: 'normal'
    },
    {
      path: '../../../public/fonts/Aeonik-Bold.woff2',
      weight: '700',
      style: 'normal'
    },
    {
      path: '../../../public/fonts/Aeonik-Black.ttf',
      weight: '900',
      style: 'normal'
    }
  ]
})

const aeonikFono = localFont({
  variable: '--font-aeonik-fono',
  display: 'swap',
  src: [
    {
      path: '../../../public/fonts/AeonikFono-Light.otf',
      weight: '300',
      style: 'normal'
    },
    {
      path: '../../../public/fonts/AeonikFono-Regular.otf',
      weight: '400',
      style: 'normal'
    }
  ]
})

const sourceCodePro = Source_Code_Pro({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--scp-font'
})

export function WithFonts({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        fontFamily: `${aeonik.style.fontFamily}, ${aeonikFono.style.fontFamily}, ${sourceCodePro.style.fontFamily}`
      }}
    >
      <style jsx global>
        {`
					:root {
						--font-aeonik: ${aeonik.style.fontFamily};
						--font-aeonik-fono: ${aeonikFono.style.fontFamily};
						--scp-font: ${sourceCodePro.style.fontFamily};
					}
				`}
      </style>

      {children}
    </div>
  )
}
