import { notFound } from 'next/navigation'
import type { ReactElement } from 'react'
import { env } from '@/env'
import { VaultWidgetParityPage } from './page-client'

export default function Page(): ReactElement {
  if (!env.DEV) {
    notFound()
  }

  return <VaultWidgetParityPage />
}
