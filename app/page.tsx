import type { ReactElement } from 'react'
import { landingMetadata } from './metadata'
import HomePageClient from './page-client'

export const metadata = landingMetadata

export default function Page(): ReactElement {
  return <HomePageClient />
}
