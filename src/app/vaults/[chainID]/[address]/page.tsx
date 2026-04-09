import type { Metadata } from 'next'
import { Suspense } from 'react'
import VaultDetailPage from '@pages/vaults/[chainID]/[address]'
import { supportedChains } from '@/config/supportedChains'

type TVaultDetailPageProps = {
  params: Promise<{
    chainID: string
    address: string
  }>
}

function getChainName(chainID: string): string {
  const chain = supportedChains.find(({ id }) => String(id) === chainID)
  return chain?.name ?? `Chain ${chainID}`
}

function getShortAddress(address: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return address
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export async function generateMetadata({ params }: TVaultDetailPageProps): Promise<Metadata> {
  const { chainID, address } = await params
  const canonicalUrl = `https://yearn.fi/vaults/${chainID}/${address}`
  const ogImageUrl = `https://og.yearn.fi/api/og/yearn/vault/${chainID}/${address}`
  const title = `Yearn Vault ${getShortAddress(address)} on ${getChainName(chainID)}`
  const description = "Earn yield on your crypto with Yearn's automated vault strategies"

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: [ogImageUrl],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl]
    }
  }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VaultDetailPage />
    </Suspense>
  )
}
