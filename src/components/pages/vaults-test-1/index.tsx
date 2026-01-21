import type { ReactElement } from 'react'
import { VaultsPage } from '@pages/vaults/index'

export default function VaultsTest1Page(): ReactElement {
  return (
    <VaultsPage
      vaultsBasePath={'/vaults-test-1'}
      listRowOverrides={{
        disableExpandedRowHover: true,
        disableExpandedRowNavigation: true
      }}
    />
  )
}
