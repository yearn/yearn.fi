import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import { buildVaultMetadata } from '../../../metadata'
import VaultsDetailPageClient from './page-client'

type TVaultPageProps = {
  params: Promise<{
    chainID: string
    address: string
  }>
}

export async function generateMetadata({ params }: TVaultPageProps): Promise<Metadata> {
  const { chainID, address } = await params
  return buildVaultMetadata(chainID, address)
}

export default function Page(): ReactElement {
  return <VaultsDetailPageClient />
}
