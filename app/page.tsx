import { HydrationBoundary } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { getLandingPageDehydratedState } from '@/server/ssr/publicDataHydration'
import { landingMetadata } from './metadata'
import HomePageClient from './page-client'

export const metadata = landingMetadata
export const revalidate = 21600

export default async function Page(): Promise<ReactElement> {
  const dehydratedState = await getLandingPageDehydratedState()

  return (
    <HydrationBoundary state={dehydratedState}>
      <HomePageClient />
    </HydrationBoundary>
  )
}
