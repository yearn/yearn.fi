import type { Metadata, Viewport } from 'next'
import { Source_Code_Pro } from 'next/font/google'
import Script from 'next/script'
import type { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro'
})

const themeInitScript = `
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
const NEW_THEME_STORAGE_KEY = 'yearn-theme'
const OLD_THEME_STORAGE_KEY = 'isDarkMode'
const THEME_EVENT_NAME = 'yearn-theme-change'

function resolveTheme() {
  const storedValue = window.localStorage.getItem(NEW_THEME_STORAGE_KEY)
  if (storedValue === 'light' || storedValue === 'soft-dark' || storedValue === 'blue-dark' || storedValue === 'midnight') {
    return storedValue
  }
  if (storedValue === 'dark') {
    window.localStorage.setItem(NEW_THEME_STORAGE_KEY, 'midnight')
    return 'midnight'
  }

  const oldStoredValue = window.localStorage.getItem(OLD_THEME_STORAGE_KEY)
  if (oldStoredValue === 'true') {
    window.localStorage.setItem(NEW_THEME_STORAGE_KEY, 'soft-dark')
    return 'soft-dark'
  }
  if (oldStoredValue === 'false') {
    window.localStorage.setItem(NEW_THEME_STORAGE_KEY, 'light')
    return 'light'
  }

  return darkModeMediaQuery.matches ? 'soft-dark' : 'light'
}

function applyTheme(theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.remove('dark', 'light', 'v3')
  if (theme === 'soft-dark' || theme === 'blue-dark' || theme === 'midnight') {
    root.classList.add('dark')
    root.classList.add('v3')
  } else {
    root.classList.add('light')
  }
}

function updateMode() {
  const theme = resolveTheme()
  applyTheme(theme)
}

updateMode()
darkModeMediaQuery.addEventListener('change', updateMode)
window.addEventListener('storage', updateMode)
window.addEventListener(THEME_EVENT_NAME, updateMode)
`

export const metadata: Metadata = {
  metadataBase: new URL('https://yearn.fi'),
  title: 'Yearn Finance',
  description: 'The yield protocol for digital assets',
  applicationName: 'Yearn Finance',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Yearn Finance',
    description: 'The yield protocol for digital assets',
    url: 'https://yearn.fi',
    siteName: 'Yearn Finance',
    images: ['https://yearn.fi/og.png'],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yearn Finance',
    description: 'The yield protocol for digital assets',
    images: ['https://yearn.fi/og.png']
  },
  icons: {
    icon: [
      { url: '/favicons/favicon.ico' },
      { url: '/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicons/android-icon-192x192.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: [
      { url: '/favicons/apple-icon.png' },
      { url: '/favicons/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' }
    ],
    shortcut: ['/favicons/favicon.ico']
  },
  appleWebApp: {
    capable: true,
    title: 'Yearn Finance',
    statusBarStyle: 'default'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000'
}

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sourceCodePro.variable} h-full antialiased`}>
      <head>
        <link rel="preload" href="/fonts/Aeonik-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Aeonik-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#000000" />
        <meta name="msapplication-config" content="/favicons/browserconfig.xml" />
      </head>
      <body className={'min-h-full'}>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
