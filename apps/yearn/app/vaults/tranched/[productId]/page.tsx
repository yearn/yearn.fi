import { getTranchedProductById } from '@pages/vaults/constants/tranchedProducts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactElement } from 'react'
import TranchedProductDetailPageClient from './page-client'

type TTranchedProductPageProps = {
  params: Promise<{ productId: string }>
}

export async function generateMetadata({ params }: TTranchedProductPageProps): Promise<Metadata> {
  const { productId } = await params
  const product = getTranchedProductById(productId)
  return product ? { title: `${product.name} | Yearn` } : { title: 'Vault not found | Yearn' }
}

export default async function Page({ params }: TTranchedProductPageProps): Promise<ReactElement> {
  const { productId } = await params
  if (!getTranchedProductById(productId)) {
    notFound()
  }

  return <TranchedProductDetailPageClient productId={productId} />
}
