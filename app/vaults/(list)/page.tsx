import { buildInitialVaultsQuerySnapshot, DEFAULT_VAULT_QUERY_DEFAULTS } from '@pages/vaults/utils/vaultsQueryState'
import { HydrationBoundary } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { getVaultsPageDehydratedState } from '@/server/ssr/publicDataHydration'
import { vaultsMetadata } from '../../metadata'
import VaultsPageClient from './page-client'

export const metadata = vaultsMetadata
export const revalidate = 3600

export default async function Page(): Promise<ReactElement> {
  const initialQueryState = buildInitialVaultsQuerySnapshot(undefined, DEFAULT_VAULT_QUERY_DEFAULTS)
  const dehydratedState = await getVaultsPageDehydratedState()

  return (
    <HydrationBoundary state={dehydratedState}>
      <VaultsPageClient initialQueryState={initialQueryState} />
    </HydrationBoundary>
  )
}
