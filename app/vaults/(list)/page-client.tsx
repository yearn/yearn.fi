'use client'

import VaultsPage from '@pages/vaults/index'
import type { TVaultsQuerySnapshot } from '@pages/vaults/utils/vaultsQueryState'
import type { ReactElement } from 'react'

type TVaultsPageClientProps = {
  initialQueryState?: TVaultsQuerySnapshot
}

export default function VaultsPageClient({ initialQueryState }: TVaultsPageClientProps): ReactElement {
  return <VaultsPage initialQueryState={initialQueryState} />
}
