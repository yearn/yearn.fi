import { HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import { getVaultDetailPageDehydratedState } from '@/server/ssr/publicDataHydration'
import { buildVaultMetadata } from '../../../metadata'
import V3VaultsDetailPageClient from './page-client'

export const dynamic = 'force-dynamic'

type TVaultPageProps = {
  params: Promise<{
    chainID: string
    address: string
  }>
}

export async function generateMetadata({ params }: TVaultPageProps): Promise<Metadata> {
  const { chainID, address } = await params
  return buildVaultMetadata(chainID, address)
}

export default async function Page({ params }: TVaultPageProps): Promise<ReactElement> {
  const { chainID, address } = await params
  const dehydratedState = await getVaultDetailPageDehydratedState(chainID, address)

  return (
    <HydrationBoundary state={dehydratedState}>
      <V3VaultsDetailPageClient />
    </HydrationBoundary>
  )
}
