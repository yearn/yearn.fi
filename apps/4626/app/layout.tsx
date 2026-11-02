import '@erc4626/app/globals.css'
import { Providers } from '@erc4626/app/providers'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'ERC-4626 Vaults | Yearn',
  description: 'Deposit and withdraw the underlying asset of an ERC-4626 vault by contract address.'
}
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
