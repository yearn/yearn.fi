import type { ReactElement, ReactNode } from 'react'

export function WithFonts({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  )
}