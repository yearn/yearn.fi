export interface ExplainMetadata {
  vaultLabel: string | null
  chainId: number | null
  chainName: string | null
  tvl: number | null
  tvlUnit: string | null
  optimizationMethod: string | null
  changesFiltered: number | null
}

export interface ExplainNoChangeStrategy {
  name: string
  currentRatio: number
  targetRatio: number
  currentApr: number | null
  targetApr: number | null
}

const EXPLAIN_VAULT_LINE_PATTERN = /^(.+)\s+\((\d+):\s*(0x[a-fA-F0-9]{40})\)/
const EXPLAIN_TVL_LINE_PATTERN = /^TVL:\s*(.+)$/im
const EXPLAIN_TVL_VALUE_PATTERN = /^\s*(\$)?\s*([\d,]+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9._-]*)?\s*$/
const EXPLAIN_OPTIMIZATION_PATTERN = /Optimization:\s*(.+)/
const EXPLAIN_CHANGES_FILTERED_PATTERN = /Changes filtered:\s*(\d+)/

function getChainName(chainId: number | null): string | null {
  if (chainId === null) return null
  const chains: Record<number, string> = {
    1: 'Mainnet',
    10: 'Optimism',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    250: 'Fantom'
  }
  return chains[chainId] ?? `Chain ${chainId}`
}

function inferVaultTokenSymbol(vaultLabel: string | null): string | null {
  if (!vaultLabel) {
    return null
  }

  const firstToken = vaultLabel.trim().split(/\s+/)[0]
  if (!firstToken) {
    return null
  }

  const symbol = firstToken.replace(/-\d+$/, '')
  return symbol || null
}

function parseTvl(explain: string, vaultLabel: string | null): { tvl: number | null; tvlUnit: string | null } {
  const tvlLineMatch = explain.match(EXPLAIN_TVL_LINE_PATTERN)
  if (!tvlLineMatch?.[1]) {
    return { tvl: null, tvlUnit: null }
  }

  const tvlValueMatch = tvlLineMatch[1].trim().match(EXPLAIN_TVL_VALUE_PATTERN)
  if (!tvlValueMatch?.[2]) {
    return { tvl: null, tvlUnit: null }
  }

  const tvl = Number.parseFloat(tvlValueMatch[2].replace(/,/g, ''))
  if (!Number.isFinite(tvl)) {
    return { tvl: null, tvlUnit: null }
  }

  const hasDollarPrefix = Boolean(tvlValueMatch[1])
  const rawUnit = tvlValueMatch[3]?.trim() ?? null
  let tvlUnit: string | null

  if (hasDollarPrefix || rawUnit?.toLowerCase() === 'usd') {
    tvlUnit = 'USD'
  } else if (rawUnit) {
    tvlUnit = rawUnit
  } else {
    tvlUnit = inferVaultTokenSymbol(vaultLabel)
  }

  return { tvl, tvlUnit }
}

export function parseExplainMetadata(explain: string): ExplainMetadata {
  const lines = explain.split('\n')
  const firstLine = lines.find((line) => EXPLAIN_VAULT_LINE_PATTERN.test(line)) ?? ''

  const vaultMatch = firstLine.match(EXPLAIN_VAULT_LINE_PATTERN)
  const optimizationMatch = explain.match(EXPLAIN_OPTIMIZATION_PATTERN)
  const changesFilteredMatch = explain.match(EXPLAIN_CHANGES_FILTERED_PATTERN)

  const chainId = vaultMatch?.[2] ? parseInt(vaultMatch[2], 10) : null
  const vaultLabel = vaultMatch?.[1]?.trim() ?? null
  const { tvl, tvlUnit } = parseTvl(explain, vaultLabel)

  return {
    vaultLabel,
    chainId,
    chainName: getChainName(chainId),
    tvl,
    tvlUnit,
    optimizationMethod: optimizationMatch?.[1]?.trim() ?? null,
    changesFiltered: changesFilteredMatch?.[1] ? parseInt(changesFilteredMatch[1], 10) : null
  }
}
