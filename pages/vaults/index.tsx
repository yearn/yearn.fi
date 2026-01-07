import type { ReactElement } from 'react'
import { lazy, Suspense } from 'react'
import { VaultsPageShell } from './VaultsPageShell'

const VaultsPageContent = lazy(() => import('./VaultsPageContent'))

export default function Index(): ReactElement {
  return (
    <Suspense fallback={<VaultsPageShell />}>
      <VaultsPageContent />
    </Suspense>
  )
}
