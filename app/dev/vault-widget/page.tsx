import { notFound } from 'next/navigation'
import type { ReactElement } from 'react'
import { env } from '@/env'
import { VaultWidgetParityPage } from './page-client'

export default function Page(): ReactElement {
  if (!env.DEV && env.NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED !== 'true') {
    notFound()
  }

  return <VaultWidgetParityPage />
}
