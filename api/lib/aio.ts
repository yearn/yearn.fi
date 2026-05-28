export const KONG_REST_BASE = (process.env.VITE_KONG_REST_URL || 'https://kong.yearn.fi/api/rest').replace(/\/$/, '')
export const SITE_URL = 'https://yearn.fi'
export const KONG_VAULT_LIST_URL = `${KONG_REST_BASE}/list/vaults`
export const KONG_SNAPSHOT_URL_PATTERN = `${KONG_REST_BASE}/snapshot/{chainId}/{address}`
export const VAULT_PAGE_URL_PATTERN = `${SITE_URL}/vaults/{chainId}/{address}`

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
  apiVersion?: string | null
  asset?: { symbol: string; name: string } | null
  tvl?: number | null
  performance?: {
    estimated?: {
      apr?: number | null
      apy?: number | null
      netAPR?: number | null
      netAPY?: number | null
      components?: { netAPR?: number | null; netAPY?: number | null } | null
    } | null
    oracle?: { apr?: number | null; apy?: number | null; netAPR?: number | null; netAPY?: number | null } | null
    historical?: { net?: number | null; monthlyNet?: number | null } | null
  } | null
  isHidden?: boolean
  isRetired?: boolean
  v3?: boolean
  type?: string | null
  kind?: string | null
  inclusion?: Record<string, boolean>
  origin?: string | null
}

export type TSnapshotStrategy = {
  name?: string
  address?: string
  strategy?: string
  status?: string | number
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
  strategies?: Array<TSnapshotStrategy | string> | null
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

function normalizeSnapshotStrategy(strategy: TSnapshotStrategy | string): TSnapshotStrategy {
  return typeof strategy === 'string' ? { address: strategy } : strategy
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

export function formatFeePct(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  const normalized = Math.abs(value) > 1 ? value / 10_000 : value
  return formatPct(normalized)
}

export function resolveVaultApy(vault: TVaultListEntry): number | null {
  const values = [
    vault.performance?.oracle?.netAPY,
    vault.performance?.oracle?.apy,
    vault.performance?.oracle?.netAPR,
    vault.performance?.oracle?.apr,
    vault.performance?.estimated?.netAPY,
    vault.performance?.estimated?.apy,
    vault.performance?.estimated?.components?.netAPY,
    vault.performance?.estimated?.components?.netAPR,
    vault.performance?.estimated?.netAPR,
    vault.performance?.estimated?.apr,
    vault.performance?.historical?.monthlyNet,
    vault.performance?.historical?.net
  ]
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value)) ?? null
}

function isCatalogYearnVault(vault: TVaultListEntry): boolean {
  return vault.origin === 'yearn' && vault.inclusion?.isYearn !== false
}

function isV3VaultListEntry(vault: TVaultListEntry): boolean {
  const version = vault.apiVersion ?? (vault.v3 ? '3' : '')
  return version.startsWith('3') || version.startsWith('~3')
}

function isAutomatedVaultListEntry(vault: TVaultListEntry): boolean {
  return vault.type === 'Automated' || vault.type === 'Automated Yearn Vault'
}

export function getVaultMarkdownListKind(vault: TVaultListEntry): 'lp' | 'singleAsset' | 'strategy' | 'legacy' {
  if (isV3VaultListEntry(vault)) {
    return vault.kind === 'Multi Strategy' ? 'singleAsset' : 'strategy'
  }

  const name = String(vault.name || '').toLowerCase()
  if (name.includes('factory') || isAutomatedVaultListEntry(vault)) {
    return 'lp'
  }

  return 'legacy'
}

export function shouldIncludeVaultsMarkdownEntry(vault: TVaultListEntry): boolean {
  if (!isCatalogYearnVault(vault)) {
    return false
  }
  if (vault.isHidden || vault.isRetired) {
    return false
  }

  const kind = getVaultMarkdownListKind(vault)
  return kind === 'singleAsset' || kind === 'lp'
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
    if (!shouldIncludeVaultsMarkdownEntry(v)) return false
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
      return `### ${chainName} (Chain ID: ${id})\n\n| Vault | Token | TVL | APY/APR (net) | Address |\n|-------|-------|-----|---------------|---------|${rows ? `\n${rows}` : ''}`
    })
    .join('\n\n')

  return `---
title: Yearn Vaults${chainLabel}
description: Kong-derived active public Yearn single asset and LP vault summary with APY, TVL, and on-chain addresses
source: ${KONG_VAULT_LIST_URL}
canonical_data: ${KONG_VAULT_LIST_URL}
derived_from_kong: true
updated: ${new Date().toISOString()}
total_vaults: ${filtered.length}
---

# Yearn Vaults${chainLabel}

Yearn operates automated yield vaults across multiple EVM-compatible chains. Each vault accepts a specific ERC-20 token and routes funds to on-chain strategies, compounding returns automatically.

This markdown is generated live from Kong REST for discovery convenience. Use \`${KONG_VAULT_LIST_URL}\` as the canonical source for current vault data.

Vault page URLs follow the pattern: \`${VAULT_PAGE_URL_PATTERN}\`
Vault snapshots follow the pattern: \`${KONG_SNAPSHOT_URL_PATTERN}\`

Included vaults match the public Yearn vault catalog: \`origin\` is \`yearn\`, \`inclusion.isYearn\` is not false, \`isHidden\` and \`isRetired\` are false, and the vault is either a Single Asset vault or an LP Token vault. Legacy vaults, underlying single-strategy entries, and non-Yearn entries are excluded. No TVL minimum is applied. APY and TVL are time-sensitive; refresh from Kong at retrieval time.

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
  const perfFee = formatFeePct(snapshot.fees?.performanceFee)
  const mgmtFee = formatFeePct(snapshot.fees?.managementFee)
  const riskLevel = snapshot.risk?.riskLevel ?? 'N/A'
  const description = snapshot.meta?.description ?? `Automated yield vault for ${tokenName} (${token}) on ${chainName}.`
  const vaultUrl = `${SITE_URL}/vaults/${chainId}/${address}`
  const sourceUrl = `${KONG_REST_BASE}/snapshot/${chainId}/${address}`

  const allStrategies = [...(snapshot.strategies ?? []), ...(snapshot.composition ?? [])].map(normalizeSnapshotStrategy)
  const strategiesSection =
    allStrategies.length > 0
      ? allStrategies
          .map((s) => {
            const name = sanitizeStrategyText(s.name ?? 'Unnamed')
              .replace(/\\/g, '\\\\')
              .replace(/\*/g, '\\*')
            const status = s.status ? ` (${sanitizeStrategyText(String(s.status))})` : ''
            const desc = s.description ? `\n  ${sanitizeStrategyText(s.description)}` : ''
            return `- **${name}**${status} — \`${s.address ?? s.strategy ?? 'N/A'}\`${desc}`
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
source: ${sourceUrl}
canonical_data: ${sourceUrl}
derived_from_kong: true
updated: ${new Date().toISOString()}
---

# ${name}${symbol ? ` (${symbol})` : ''}

${description}

**URL:** ${vaultUrl}
**Canonical data:** ${sourceUrl}

This markdown is generated live from Kong REST for discovery convenience. Use the canonical JSON snapshot for current APY, TVL, strategy composition, fees, and availability.

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
