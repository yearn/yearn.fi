import { Providers } from '@wrapped/app/providers'
import type { Metadata } from 'next'
import Script from 'next/script'
import '@wrapped/app/globals.css'

export const metadata: Metadata = {
  title: 'Yearn Wrapped · Your year in yVaults',
  description: 'Your 2026 Yearn story, built from your onchain activity.',
  robots: { index: false, follow: false },
  icons: { icon: '/yearn-symbol-white-rgb.png' }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="wrapped-theme-init" strategy="beforeInteractive">
          {`try { const theme = localStorage.getItem('yearn-theme'); document.documentElement.dataset.theme = ['light', 'soft-dark', 'blue-dark', 'midnight'].includes(theme) ? theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'soft-dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }`}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
