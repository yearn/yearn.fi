import landingManifest from '@shared/data/landing-manifest.json'
import vaultsManifest from '@shared/data/vaults-manifest.json'
import type { Metadata } from 'next'

export function buildManifestMetadata(manifest: typeof landingManifest | typeof vaultsManifest): Metadata {
  return {
    title: manifest.name,
    description: manifest.description,
    alternates: {
      canonical: manifest.uri
    },
    openGraph: {
      title: manifest.name,
      description: manifest.description,
      url: manifest.uri,
      images: manifest.og ? [manifest.og] : undefined,
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title: manifest.name,
      description: manifest.description,
      images: manifest.og ? [manifest.og] : undefined
    }
  }
}

export function buildVaultMetadata(chainID: string, address: string): Metadata {
  const isValidChainID = /^\d+$/.test(chainID)
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address)
  const canonicalPath = isValidChainID && isValidAddress ? `/vaults/${chainID}/${address}` : '/vaults'
  const ogImage =
    isValidChainID && isValidAddress
      ? `https://og.yearn.fi/api/og/yearn/vault/${chainID}/${address}`
      : vaultsManifest.og
  const title = 'Yearn Vault'
  const description = "Earn yield on your crypto with Yearn's automated vault strategies"

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      images: ogImage ? [ogImage] : undefined,
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined
    }
  }
}

export const landingMetadata = buildManifestMetadata(landingManifest)
export const vaultsMetadata = buildManifestMetadata(vaultsManifest)
export const portfolioMetadata: Metadata = {
  ...vaultsMetadata,
  title: 'Yearn Portfolio',
  alternates: {
    canonical: '/portfolio'
  }
}
