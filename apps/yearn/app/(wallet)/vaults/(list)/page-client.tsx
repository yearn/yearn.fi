'use client'

import VaultsPage from '@pages/vaults/index'
import type { TVaultsInitialPayload } from '@pages/vaults/utils/vaultsInitialPayload'
import type { TVaultsQuerySnapshot } from '@pages/vaults/utils/vaultsQueryState'
import type { ReactElement } from 'react'

type TVaultsPageClientProps = {
  initialQueryState?: TVaultsQuerySnapshot
  initialVaults?: TVaultsInitialPayload
}

export default function VaultsPageClient({ initialQueryState, initialVaults }: TVaultsPageClientProps): ReactElement {
  return <VaultsPage initialQueryState={initialQueryState} initialVaults={initialVaults} />
}
