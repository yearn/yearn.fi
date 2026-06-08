import {
  buildInitialVaultsQuerySnapshot,
  DEFAULT_VAULT_QUERY_DEFAULTS,
  type TVaultsRouteSearchParams
} from '@pages/vaults/utils/vaultsQueryState'
import type { ReactElement } from 'react'
import { getPublicVaultListViewModel } from '@/server/ssr/publicVaultListViewModel'
import { vaultsMetadata } from '../../metadata'
import VaultsPageClient from './page-client'

export const metadata = vaultsMetadata
export const revalidate = 21600

type TVaultsPageProps = {
  searchParams?: Promise<TVaultsRouteSearchParams>
}

export default async function Page({ searchParams }: TVaultsPageProps): Promise<ReactElement> {
  const initialQueryState = buildInitialVaultsQuerySnapshot(await searchParams, DEFAULT_VAULT_QUERY_DEFAULTS)
  const initialPublicVaultList = await getPublicVaultListViewModel(initialQueryState)

  return <VaultsPageClient initialQueryState={initialQueryState} initialPublicVaultList={initialPublicVaultList} />
}
