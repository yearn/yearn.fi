'use client'

import VaultsPage from '@pages/vaults/index'
import type { TVaultsQuerySnapshot } from '@pages/vaults/utils/vaultsQueryState'
import type { ReactElement } from 'react'
import type { TPublicVaultListViewModel } from '@/server/ssr/publicVaultListViewModel'

type TVaultsPageClientProps = {
  initialQueryState?: TVaultsQuerySnapshot
  initialPublicVaultList?: TPublicVaultListViewModel
}

export default function VaultsPageClient({
  initialQueryState,
  initialPublicVaultList
}: TVaultsPageClientProps): ReactElement {
  return <VaultsPage initialQueryState={initialQueryState} initialPublicVaultList={initialPublicVaultList} />
}
