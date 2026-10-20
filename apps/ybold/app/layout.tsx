import { Providers } from '@ybold/app/providers'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

const title = 'yBOLD — Earn BOLD yield automatically | Yearn'
const description =
  'Deposit BOLD once and earn across Liquity V2 Stability Pools automatically. Auto-compounded, rebalanced, and withdrawable anytime. By Yearn.'
const ogImage = 'https://og.yearn.fi/api/og/yearn/vault/1/0x9f4330700a36b29952869fac9b33f45eedd8a3d8'

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    type: 'website',
    title,
    description,
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'yBOLD — Earn on BOLD by Yearn' }]
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [ogImage]
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
