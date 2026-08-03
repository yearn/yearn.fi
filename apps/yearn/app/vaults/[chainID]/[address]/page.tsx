import { JsonLd } from '@shared/components/JsonLd'
import { HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import { getVaultDetailPageDehydratedState } from '@/server/ssr/publicDataHydration'
import { buildVaultMetadata, buildVaultStructuredData, yearnOrganizationJsonLd } from '../../../metadata'
import VaultsDetailPageClient from './page-client'

export const revalidate = 21600

type TVaultPageProps = {
  params: Promise<{
    chainID: string
    address: string
  }>
}

export async function generateMetadata({ params }: TVaultPageProps): Promise<Metadata> {
  const { chainID, address } = await params
  return await buildVaultMetadata(chainID, address)
}

export default async function Page({ params }: TVaultPageProps): Promise<ReactElement> {
  const { chainID, address } = await params
  const structuredData = await buildVaultStructuredData(chainID, address)
  const dehydratedState = await getVaultDetailPageDehydratedState(chainID, address)

  return (
    <>
      {structuredData ? (
        <>
          <JsonLd schema={yearnOrganizationJsonLd} />
          <JsonLd schema={structuredData} />
        </>
      ) : null}
      <HydrationBoundary state={dehydratedState}>
        <VaultsDetailPageClient />
      </HydrationBoundary>
    </>
  )
}
