import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Providers } from '@/app/providers'
import '@/app/globals.css'

const themeInitializationScript = `
  (() => {
    const root = document.documentElement;
    const theme = (() => {
      try {
        return window.localStorage.getItem("ytranche-theme") === "dark" ? "dark" : "light";
      } catch {
        return "light";
      }
    })();

    root.dataset.ytrancheTheme = theme;
    root.style.colorScheme = theme;
  })();
`

export const metadata: Metadata = {
  title: 'Yearn Earn',
  description: 'A simple way to access senior-priority USDC yield through Yearn.',
  icons: {
    icon: '/favicon.ico'
  }
}

export const viewport: Viewport = {
  themeColor: '#f4f7ff'
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: fixed first-party script prevents a stored-theme flash before hydration */}
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
