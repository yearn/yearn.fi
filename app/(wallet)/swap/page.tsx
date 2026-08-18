import type { ReactElement } from 'react'
import { swapMetadata } from '../../metadata'
import SwapPageClient from './page-client'

export const metadata = swapMetadata

export default function Page(): ReactElement {
  return <SwapPageClient />
}
