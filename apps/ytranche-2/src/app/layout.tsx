import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Providers } from '@/app/providers'
import '@/app/globals.css'

const themeInitializationScript = `
  (() => {
    const root = document.documentElement;
    const preference = (() => {
      try {
        const stored = window.localStorage.getItem("yearn-theme");
        const legacy = window.localStorage.getItem("ytranche-theme");
        if (!stored && (legacy === "light" || legacy === "dark")) {
          const migrated = legacy === "dark" ? "soft-dark" : "light";
          window.localStorage.setItem("yearn-theme", migrated);
          return migrated;
        }
        if (["light", "soft-dark", "blue-dark", "midnight"].includes(stored)) return stored;
        if (stored === "dark") return "midnight";
        const oldPreference = window.localStorage.getItem("isDarkMode");
        if (oldPreference === "true") return "soft-dark";
        if (oldPreference === "false") return "light";
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "soft-dark" : "light";
      } catch {
        return "light";
      }
    })();
    const theme = preference === "light" ? "light" : "dark";
    root.dataset.theme = preference;
    root.dataset.ytrancheTheme = theme;
  })();
`

export const metadata: Metadata = {
  title: 'yTranche 2 | Yearn',
  description: 'A simple way to access senior-priority USDC yield through Yearn.',
  icons: {
    icon: '/favicon.ico'
  }
}

export const viewport: Viewport = {
  themeColor: '#ffffff'
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
