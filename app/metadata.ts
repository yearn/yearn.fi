import landingManifest from '@shared/data/landing-manifest.json'
import { buildVaultSnapshotEndpoint } from '@shared/data/publicQueryEndpoints'
import vaultsManifest from '@shared/data/vaults-manifest.json'
import { formatApyDisplay, formatTvlDisplay, toAddress } from '@shared/utils'
import { fetchWithSchema } from '@shared/utils/fetchQuery'
import { kongVaultSnapshotSchema, type TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { getNetwork } from '@shared/utils/wagmi'
import type { Metadata } from 'next'
import { cache } from 'react'
import { isAddress } from 'viem'

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

type TVaultMetadataInput = {
  chainID: string
  address: string
  snapshot?: TKongVaultSnapshot | null
}

const genericVaultTitle = 'Yearn Vault'
const genericVaultDescription = "Earn yield on your crypto with Yearn's automated vault strategies"

export const yearnOrganizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://yearn.fi/#organization',
  name: 'Yearn Finance',
  alternateName: 'Yearn',
  url: 'https://yearn.fi',
  logo: 'https://yearn.fi/favicons/android-icon-192x192.png',
  description: 'DeFi yield aggregator — automatically maximize returns on deposited digital assets.',
  sameAs: ['https://github.com/yearn', 'https://x.com/yearnfi', 'https://docs.yearn.fi', 'https://discord.gg/yearn/']
}

function isValidVaultMetadataParams(chainID: string, address: string): boolean {
  const isValidChainID = /^\d+$/.test(chainID)
  const isValidAddress = isAddress(address)
  return isValidChainID && isValidAddress
}

const VAULT_METADATA_TIMEOUT_MS = 7000

const fetchVaultMetadataSnapshot = cache(async function fetchVaultMetadataSnapshot(
  chainID: string,
  address: string
): Promise<TKongVaultSnapshot | null> {
  const endpoint = buildVaultSnapshotEndpoint(chainID, address)
  if (!endpoint) {
    return null
  }

  try {
    return await fetchWithSchema(endpoint, kongVaultSnapshotSchema, { timeout: VAULT_METADATA_TIMEOUT_MS })
  } catch (error) {
    console.warn(`[Metadata] Failed to fetch vault snapshot ${chainID}/${address}`, error)
    return null
  }
})

function pickFirstText(...values: Array<string | null | undefined>): string {
  return values.map((value) => value?.trim() ?? '').find(Boolean) ?? ''
}

function pickFirstNumber(...values: Array<number | null | undefined>): number | null {
  return values.find((value) => typeof value === 'number' && Number.isFinite(value)) ?? null
}

function buildVaultDescription({
  assetSymbol,
  chainName,
  name,
  apy,
  tvl
}: {
  assetSymbol: string
  chainName: string
  name: string
  apy: number | null
  tvl: number | null
}): string {
  const assetCopy = assetSymbol ? `${assetSymbol} ` : ''
  const apyCopy = apy === null ? null : `Est. APY ${formatApyDisplay(apy)}`
  const tvlCopy = tvl === null ? null : `TVL ${formatTvlDisplay(tvl)}`
  const metricsCopy = [apyCopy, tvlCopy].filter(Boolean).join(' and ')
  const suffix = metricsCopy ? ` ${metricsCopy}.` : ''
  return `Earn yield with ${name}, a Yearn ${assetCopy}vault on ${chainName}.${suffix}`
}

function buildVaultCanonicalUrl(chainID: string, address: string): string {
  return `https://yearn.fi/vaults/${chainID}/${toAddress(address)}`
}

function buildVaultMarkdownUrl(chainID: string, address: string): string {
  return `https://yearn.fi/api/vault/markdown?chainId=${chainID}&address=${toAddress(address)}`
}

function buildVaultDiscoveryUrls(
  chainID: string,
  address: string
): {
  canonicalUrl: string
  markdownUrl: string
  normalizedAddress: string
  snapshotUrl: string
} | null {
  if (!isValidVaultMetadataParams(chainID, address)) {
    return null
  }

  const normalizedAddress = toAddress(address)
  const snapshotUrl = buildVaultSnapshotEndpoint(chainID, normalizedAddress)
  if (!snapshotUrl) {
    return null
  }

  return {
    canonicalUrl: buildVaultCanonicalUrl(chainID, normalizedAddress),
    markdownUrl: buildVaultMarkdownUrl(chainID, normalizedAddress),
    normalizedAddress,
    snapshotUrl
  }
}

export function buildVaultMetadataFromInput({ chainID, address, snapshot }: TVaultMetadataInput): Metadata {
  const discoveryUrls = buildVaultDiscoveryUrls(chainID, address)
  const canonicalPath = discoveryUrls ? `/vaults/${chainID}/${discoveryUrls.normalizedAddress}` : '/vaults'
  const ogImage = discoveryUrls
    ? `https://og.yearn.fi/api/og/yearn/vault/${chainID}/${discoveryUrls.normalizedAddress}`
    : vaultsManifest.og
  const chainIdNumber = Number(chainID)
  const chainName = Number.isInteger(chainIdNumber) ? getNetwork(chainIdNumber).name : 'Yearn'
  const name = pickFirstText(snapshot?.meta?.displayName, snapshot?.meta?.name, snapshot?.name, genericVaultTitle)
  const symbol = pickFirstText(snapshot?.meta?.displaySymbol, snapshot?.symbol)
  const assetSymbol = pickFirstText(snapshot?.meta?.token?.symbol, snapshot?.asset?.symbol)
  const title = symbol ? `${name} (${symbol})` : name
  const apy = pickFirstNumber(
    snapshot?.apy?.net,
    snapshot?.performance?.estimated?.apy,
    snapshot?.performance?.estimated?.apr,
    snapshot?.performance?.oracle?.netAPY,
    snapshot?.performance?.oracle?.apy,
    snapshot?.performance?.oracle?.netAPR,
    snapshot?.performance?.oracle?.apr
  )
  const tvl = pickFirstNumber(snapshot?.tvl?.close)
  const description = snapshot
    ? buildVaultDescription({ assetSymbol, chainName, name, apy, tvl })
    : genericVaultDescription

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
      ...(discoveryUrls
        ? {
            types: {
              'text/markdown': [{ title: 'Vault markdown', url: discoveryUrls.markdownUrl }],
              'application/json': [{ title: 'Canonical Kong vault snapshot', url: discoveryUrls.snapshotUrl }]
            }
          }
        : {})
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
    },
    ...(discoveryUrls
      ? {
          other: {
            'yearn:chainId': chainID,
            'yearn:vaultAddress': discoveryUrls.normalizedAddress,
            'yearn:markdown': discoveryUrls.markdownUrl,
            'yearn:canonicalData': discoveryUrls.snapshotUrl
          }
        }
      : {})
  }
}

export function buildVaultStructuredDataFromInput({
  chainID,
  address,
  snapshot
}: TVaultMetadataInput): Record<string, unknown> | null {
  if (!isValidVaultMetadataParams(chainID, address)) {
    return null
  }

  const discoveryUrls = buildVaultDiscoveryUrls(chainID, address)
  if (!discoveryUrls) {
    return null
  }

  const chainIdNumber = Number(chainID)
  const chainName = getNetwork(chainIdNumber).name
  const name = pickFirstText(snapshot?.meta?.displayName, snapshot?.meta?.name, snapshot?.name, genericVaultTitle)
  const symbol = pickFirstText(snapshot?.meta?.displaySymbol, snapshot?.symbol)
  const assetSymbol = pickFirstText(snapshot?.meta?.token?.symbol, snapshot?.asset?.symbol)
  const apy = pickFirstNumber(
    snapshot?.apy?.net,
    snapshot?.performance?.estimated?.apy,
    snapshot?.performance?.estimated?.apr,
    snapshot?.performance?.oracle?.netAPY,
    snapshot?.performance?.oracle?.apy,
    snapshot?.performance?.oracle?.netAPR,
    snapshot?.performance?.oracle?.apr
  )
  const title = symbol ? `${name} (${symbol})` : name
  const description = snapshot
    ? buildVaultDescription({
        assetSymbol,
        chainName,
        name,
        apy,
        tvl: pickFirstNumber(snapshot.tvl?.close)
      })
    : genericVaultDescription
  const annualPercentageRate =
    apy === null
      ? undefined
      : {
          '@type': 'QuantitativeValue',
          value: Number((apy * 100).toFixed(2)),
          unitText: 'PERCENT'
        }

  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: title,
    description,
    url: discoveryUrls.canonicalUrl,
    sameAs: [discoveryUrls.snapshotUrl, discoveryUrls.markdownUrl],
    ...(annualPercentageRate ? { annualPercentageRate } : {}),
    provider: {
      '@id': yearnOrganizationJsonLd['@id'],
      '@type': 'Organization',
      name: yearnOrganizationJsonLd.name,
      url: yearnOrganizationJsonLd.url
    },
    offers: {
      '@type': 'Offer',
      category: 'Yield Vault',
      description: `Automated yield vault for ${assetSymbol || symbol || 'crypto'} on ${chainName}`
    }
  }
}

export async function buildVaultMetadata(chainID: string, address: string): Promise<Metadata> {
  const snapshot = isValidVaultMetadataParams(chainID, address)
    ? await fetchVaultMetadataSnapshot(chainID, address)
    : null
  return buildVaultMetadataFromInput({ chainID, address, snapshot })
}

export async function buildVaultStructuredData(
  chainID: string,
  address: string
): Promise<Record<string, unknown> | null> {
  const snapshot = isValidVaultMetadataParams(chainID, address)
    ? await fetchVaultMetadataSnapshot(chainID, address)
    : null
  return buildVaultStructuredDataFromInput({ chainID, address, snapshot })
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
