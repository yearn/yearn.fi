import { Suspense } from 'react'
import VaultsPage from '@pages/vaults/index'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VaultsPage />
    </Suspense>
  )
}
