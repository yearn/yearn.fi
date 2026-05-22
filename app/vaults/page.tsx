import { HydrationBoundary } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { getVaultsPageDehydratedState } from '@/server/ssr/publicDataHydration'
import { vaultsMetadata } from '../metadata'
import VaultsPageClient from './page-client'

export const metadata = vaultsMetadata
export const dynamic = 'force-dynamic'

export default async function Page(): Promise<ReactElement> {
  const dehydratedState = await getVaultsPageDehydratedState()

  return (
    <HydrationBoundary state={dehydratedState}>
      <VaultsPageClient />
    </HydrationBoundary>
  )
}
