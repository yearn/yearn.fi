import type { ReactElement, ReactNode } from 'react'

export function WithFonts({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      {/* Preload critical Aeonik fonts */}
      <link
        rel="preload"
        href="/fonts/Aeonik-Regular.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/fonts/Aeonik-Bold.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link rel="stylesheet" href="/fonts/fonts.css" />
      {children}
    </>
  )
}
