import type { ReactElement } from 'react'
import { portfolioMetadata } from '../metadata'
import PortfolioPageClient from './page-client'

export const metadata = portfolioMetadata

export default function Page(): ReactElement {
  return <PortfolioPageClient />
}
