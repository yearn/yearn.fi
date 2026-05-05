export const KONG_REST_BASE = (process.env.VITE_KONG_REST_URL || 'https://kong.yearn.fi/api/rest').replace(/\/$/, '')
export const SITE_URL = 'https://yearn.fi'

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  250: 'Fantom',
  8453: 'Base',
  42161: 'Arbitrum',
  146: 'Sonic',
  747474: 'Katana'
}

export const SITEMAP_STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/vaults', priority: '0.9', changefreq: 'hourly' },
  { path: '/portfolio', priority: '0.7', changefreq: 'daily' }
]

// --- Types ---

export type TVaultListEntry = {
  chainId: number
  address: string
  name?: string
  symbol?: string | null
  asset?: { symbol: string; name: string } | null
  tvl?: number | null
  performance?: {
    estimated?: { apy?: number | null } | null
    oracle?: { apy?: number | null } | null
    historical?: { monthlyNet?: number | null } | null
  } | null
  isHidden?: boolean
  isRetired?: boolean
  v3?: boolean
  kind?: string | null
}

export type TSnapshotStrategy = {
  name?: string
  address?: string
  status?: string
  description?: string
}

export type TVaultSnapshot = {
  name?: string
  symbol?: string
  apiVersion?: string | null
  kind?: string | null
  asset?: { symbol: string; name: string; address: string } | null
  tvl?: { close?: number | null } | null
  apy?: {
    net?: number | null
    grossApr?: number | null
    weeklyNet?: number | null
    monthlyNet?: number | null
    inceptionNet?: number | null
  } | null
  fees?: { managementFee?: number | null; performanceFee?: number | null } | null
  risk?: { riskLevel?: number | null } | null
  strategies?: TSnapshotStrategy[] | null
  composition?: TSnapshotStrategy[] | null
  meta?: { description?: string; isRetired?: boolean; isBoosted?: boolean } | null
}

// --- Formatters ---

function escapeMdPipe(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

function sanitizeStrategyText(str: string): string {
  return str.replace(/[\r\n]+/g, ' ').trim()
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return `${(value * 100).toFixed(2)}%`
}

export function resolveVaultApy(vault: TVaultListEntry): number | null {
  return (
    vault.performance?.oracle?.apy ??
    vault.performance?.estimated?.apy ??
    vault.performance?.historical?.monthlyNet ??
    null
  )
}

// --- Builders ---

export function buildSitemap(vaults: TVaultListEntry[]): string {
  const today = new Date().toISOString().slice(0, 10)

  const staticUrls = SITEMAP_STATIC_PAGES.map(
    ({ path, priority, changefreq }) =>
      `  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  ).join('\n')

  const vaultUrls = vaults
    .filter((v) => !v.isHidden && !v.isRetired)
    .map(
      (v) =>
        `  <url>\n    <loc>${SITE_URL}/vaults/${v.chainId}/${v.address}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>0.6</priority>\n  </url>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${vaultUrls}
</urlset>`
}

export function buildVaultsMarkdown(vaults: TVaultListEntry[], chainId?: number): string {
  const filtered = vaults.filter((v) => {
    if (v.isHidden || v.isRetired) return false
    if (chainId != null) return v.chainId === chainId
    return true
  })

  const chainIds = [...new Set(filtered.map((v) => v.chainId))].sort((a, b) => a - b)
  const chainLabel = chainId != null ? ` — ${CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}` : ''

  const chainSections = chainIds
    .map((id) => {
      const chainName = CHAIN_NAMES[id] ?? `Chain ${id}`
      const rows = filtered
        .filter((v) => v.chainId === id)
        .map((v) => {
          const token = escapeMdPipe(v.asset?.symbol ?? v.symbol ?? 'Unknown')
          const name = escapeMdPipe(v.name ?? 'Unknown')
          const url = `${SITE_URL}/vaults/${v.chainId}/${v.address}`
          return `| [${name}](${url}) | ${token} | ${formatUsd(v.tvl)} | ${formatPct(resolveVaultApy(v))} | \`${v.address}\` |`
        })
        .join('\n')
      return `### ${chainName} (Chain ID: ${id})\n\n| Vault | Token | TVL | APY (net) | Address |\n|-------|-------|-----|-----------|---------|${rows ? `\n${rows}` : ''}`
    })
    .join('\n\n')

  return `---
title: Yearn Vaults${chainLabel}
description: Active yield vaults operated by Yearn with APY, TVL, and on-chain addresses
source: ${KONG_REST_BASE}/list/vaults
updated: ${new Date().toISOString()}
total_vaults: ${filtered.length}
---

# Yearn Vaults${chainLabel}

Yearn operates automated yield vaults across multiple EVM-compatible chains. Each vault accepts a specific ERC-20 token and routes funds to the highest-yielding on-chain strategies, compounding returns automatically.

Vault URLs follow the pattern: \`${SITE_URL}/vaults/{chainId}/{address}\`

## Vaults

${chainSections}
`
}

export function buildVaultMarkdown(snapshot: TVaultSnapshot, chainId: number, address: string): string {
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`
  const name = snapshot.name ?? 'Unknown Vault'
  const symbol = snapshot.symbol ?? ''
  const token = snapshot.asset?.symbol ?? symbol ?? 'Unknown'
  const tokenName = snapshot.asset?.name ?? 'Unknown'
  const tvl = formatUsd(snapshot.tvl?.close)
  const netApy = formatPct(snapshot.apy?.net)
  const grossApr = formatPct(snapshot.apy?.grossApr)
  const weeklyNet = formatPct(snapshot.apy?.weeklyNet)
  const monthlyNet = formatPct(snapshot.apy?.monthlyNet)
  const inceptionNet = formatPct(snapshot.apy?.inceptionNet)
  const perfFee = formatPct(snapshot.fees?.performanceFee)
  const mgmtFee = formatPct(snapshot.fees?.managementFee)
  const riskLevel = snapshot.risk?.riskLevel ?? 'N/A'
  const description = snapshot.meta?.description ?? `Automated yield vault for ${tokenName} (${token}) on ${chainName}.`
  const vaultUrl = `${SITE_URL}/vaults/${chainId}/${address}`

  const allStrategies = [...(snapshot.strategies ?? []), ...(snapshot.composition ?? [])]
  const strategiesSection =
    allStrategies.length > 0
      ? allStrategies
          .map((s) => {
            const name = sanitizeStrategyText(s.name ?? 'Unnamed')
              .replace(/\\/g, '\\\\')
              .replace(/\*/g, '\\*')
            const status = s.status ? ` (${sanitizeStrategyText(s.status)})` : ''
            const desc = s.description ? `\n  ${sanitizeStrategyText(s.description)}` : ''
            return `- **${name}**${status} — \`${s.address ?? 'N/A'}\`${desc}`
          })
          .join('\n')
      : '_No strategy data available._'

  return `---
title: ${name}
chain: ${chainName}
chainId: ${chainId}
address: ${address}
token: ${token}
tvl: ${tvl}
apy_net: ${netApy}
url: ${vaultUrl}
updated: ${new Date().toISOString()}
---

# ${name}${symbol ? ` (${symbol})` : ''}

${description}

**URL:** ${vaultUrl}

## Overview

| Field | Value |
|-------|-------|
| Chain | ${chainName} (ID: ${chainId}) |
| Token | ${tokenName} (${token}) |
| Token Address | \`${snapshot.asset?.address ?? 'N/A'}\` |
| Vault Address | \`${address}\` |
| API Version | ${snapshot.apiVersion ?? 'N/A'} |
| Kind | ${snapshot.kind ?? 'N/A'} |
| TVL | ${tvl} |
| Risk Level | ${riskLevel} |

## Performance

| Period | Net APY/APR |
|--------|-------------|
| Current (net APY) | ${netApy} |
| Gross APR | ${grossApr} |
| 7-day net | ${weeklyNet} |
| 30-day net | ${monthlyNet} |
| Since inception | ${inceptionNet} |

## Fees

| Fee | Rate |
|-----|------|
| Performance | ${perfFee} |
| Management | ${mgmtFee} |

## Strategies

${strategiesSection}
`
}
