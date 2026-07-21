'use client'

import TranchedProductDetailPage from '@pages/vaults/tranched/[productId]'
import type { ReactElement } from 'react'

export default function TranchedProductDetailPageClient({ productId }: { productId: string }): ReactElement {
  return <TranchedProductDetailPage productId={productId} />
}
