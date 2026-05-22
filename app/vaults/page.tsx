import type { ReactElement } from 'react'
import { vaultsMetadata } from '../metadata'
import VaultsPageClient from './page-client'

export const metadata = vaultsMetadata

export default function Page(): ReactElement {
  return <VaultsPageClient />
}
