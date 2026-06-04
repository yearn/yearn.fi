import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import App from '@/App'
import '../style.css'

const aeonik = localFont({
  src: [
    { path: '../public/fonts/Aeonik-Light.ttf', weight: '300', style: 'normal' },
    { path: '../public/fonts/Aeonik-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/Aeonik-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../public/fonts/Aeonik-Black.ttf', weight: '900', style: 'normal' }
  ],
  variable: '--font-aeonik',
  display: 'swap'
})

const aeonikFono = localFont({
  src: [
    { path: '../public/fonts/AeonikFono-Light.otf', weight: '300', style: 'normal' },
    { path: '../public/fonts/AeonikFono-Regular.otf', weight: '400', style: 'normal' }
  ],
  variable: '--font-aeonik-fono',
  display: 'swap'
})

const aeonikMono = localFont({
  src: [
    { path: '../public/fonts/AeonikMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/AeonikMono-Bold.woff2', weight: '700', style: 'normal' }
  ],
  variable: '--font-aeonik-mono',
  display: 'swap'
})

const defaultDescription = 'The yield protocol for digital assets'
const defaultOgImage = '/og.png'

export const metadata: Metadata = {
  metadataBase: new URL('https://yearn.fi'),
  title: {
    default: 'Yearn Finance',
    template: '%s | Yearn'
  },
  description: defaultDescription,
  manifest: '/manifest.json',
  applicationName: 'Yearn Finance',
  appleWebApp: {
    capable: true,
    title: 'Yearn Finance',
    statusBarStyle: 'default'
  },
  formatDetection: {
    telephone: false
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  openGraph: {
    title: 'Yearn Finance',
    description: defaultDescription,
    url: 'https://yearn.fi',
    siteName: 'Yearn Finance',
    type: 'website',
    images: [defaultOgImage]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yearn Finance',
    description: defaultDescription,
    images: [defaultOgImage]
  },
  icons: {
    icon: [
      { url: '/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicons/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicons/android-icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicons/android-icon-144x144.png', sizes: '144x144', type: 'image/png' }
    ],
    shortcut: '/favicons/favicon.ico',
    apple: [
      { url: '/favicons/apple-icon.png' },
      { url: '/favicons/apple-icon-152x152.png', sizes: '152x152' },
      { url: '/favicons/apple-icon-180x180.png', sizes: '180x180' },
      { url: '/favicons/apple-icon-167x167.png', sizes: '167x167' }
    ],
    other: [{ rel: 'mask-icon', url: '/favicons/safari-pinned-tab.svg', color: '#000000' }]
  },
  other: {
    'msapplication-TileColor': '#ffffff',
    'msapplication-config': '/favicons/browserconfig.xml',
    'msapplication-tap-highlight': 'no'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000'
}

const themeScript = `
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const NEW_THEME_STORAGE_KEY = 'yearn-theme';
const OLD_THEME_STORAGE_KEY = 'isDarkMode';
const THEME_EVENT_NAME = 'yearn-theme-change';

function resolveTheme() {
  const storedValue = window.localStorage.getItem(NEW_THEME_STORAGE_KEY);
  if (storedValue === 'light' || storedValue === 'soft-dark' || storedValue === 'blue-dark' || storedValue === 'midnight') {
    return storedValue;
  }
  if (storedValue === 'dark') {
    window.localStorage.setItem(NEW_THEME_STORAGE_KEY, 'midnight');
    return 'midnight';
  }

  const oldStoredValue = window.localStorage.getItem(OLD_THEME_STORAGE_KEY);
  if (oldStoredValue === 'true') {
    window.localStorage.setItem(NEW_THEME_STORAGE_KEY, 'soft-dark');
    return 'soft-dark';
  }
  if (oldStoredValue === 'false') {
    window.localStorage.setItem(NEW_THEME_STORAGE_KEY, 'light');
    return 'light';
  }

  return darkModeMediaQuery.matches ? 'soft-dark' : 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.remove('dark', 'light', 'v3');
  if (theme === 'soft-dark' || theme === 'blue-dark' || theme === 'midnight') {
    root.classList.add('dark');
    root.classList.add('v3');
  } else {
    root.classList.add('light');
  }
}

function updateMode() {
  applyTheme(resolveTheme());
}

updateMode();
darkModeMediaQuery.addEventListener('change', updateMode);
window.addEventListener('storage', updateMode);
window.addEventListener(THEME_EVENT_NAME, updateMode);
`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="duration-150 transition-colors" suppressHydrationWarning>
      <body className={`${aeonik.variable} ${aeonikFono.variable} ${aeonikMono.variable}`}>
        <Script id="yearn-theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <Suspense>
          <App>{children}</App>
        </Suspense>
      </body>
    </html>
  )
}
