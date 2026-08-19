'use client'

import HomePage from '@pages/landing'
import type { TLifetimeEarningsHeadline } from '@shared/utils/schemas/lifetimeEarningsSchema'
import type { ReactElement } from 'react'

export default function HomePageClient({
  earningsHeadline
}: {
  earningsHeadline: TLifetimeEarningsHeadline | null
}): ReactElement {
  return <HomePage earningsHeadline={earningsHeadline} />
}
