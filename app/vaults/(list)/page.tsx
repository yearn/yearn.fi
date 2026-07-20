import { buildInitialVaultsQuerySnapshot, DEFAULT_VAULT_QUERY_DEFAULTS } from '@pages/vaults/utils/vaultsQueryState'
import type { ReactElement } from 'react'
import { getVaultsPageInitialPayload } from '@/server/ssr/publicDataHydration'
import { vaultsMetadata } from '../../metadata'
import VaultsPageClient from './page-client'

export const metadata = vaultsMetadata
export const revalidate = 3600

export default async function Page(): Promise<ReactElement> {
  const initialQueryState = buildInitialVaultsQuerySnapshot(undefined, DEFAULT_VAULT_QUERY_DEFAULTS)
  const initialVaults = await getVaultsPageInitialPayload()

  return <VaultsPageClient initialQueryState={initialQueryState} initialVaults={initialVaults} />
}
