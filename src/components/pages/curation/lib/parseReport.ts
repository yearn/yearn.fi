export type TReportType = 'Protocol' | 'Asset'

export type TReportMeta = {
  slug: string
  name: string
  date: string
  token: string
  chain: string
  finalScore: number
  type: TReportType
  iconUrl: string
  chainIconUrl: string
}

export type TCategoryScore = {
  category: string
  score: number
  weight: string
  weighted: number
}

export type TReportData = TReportMeta & {
  overviewMarkdown: string
  scoreTable: TCategoryScore[]
  riskSummaryMarkdown: string
}

const TYPE_OVERRIDES: Record<string, TReportType> = {
  'unit-ubtc': 'Asset'
}

const DEFILLAMA_SLUG_OVERRIDES: Record<string, string> = {
  'midas-mhyper': 'midas-rwa',
  infinifi: 'infinifi',
  'reserve-ethplus': 'reserve-protocol'
}

const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  polygon: 137,
  optimism: 10,
  bnb: 56,
  avalanche: 43114
}

const FALLBACK_CATEGORY_PATTERNS = [
  { name: 'Audits & Historical', weight: '20%' },
  { name: 'Centralization & Control', weight: '30%' },
  { name: 'Funds Management', weight: '30%' },
  { name: 'Liquidity Risk', weight: '15%' },
  { name: 'Operational Risk', weight: '5%' }
] as const

function parseDefillamaSlug(slug: string, content: string): string {
  const override = DEFILLAMA_SLUG_OVERRIDES[slug]
  if (override) {
    return override
  }

  const match = content.match(/defillama\.com\/protocol\/([a-z0-9-]+)/i)
  return match?.[1] ?? ''
}

function getIconUrl(defillamaSlug: string): string {
  if (!defillamaSlug) {
    return ''
  }
  return `https://icons.llamao.fi/icons/protocols/${defillamaSlug}?w=48&h=48`
}

function getChainIconUrl(chain: string): string {
  const lowerChain = chain.toLowerCase()
  if (lowerChain.includes('hyperliquid') || lowerChain.includes('hyperev')) {
    return 'https://icons.llamao.fi/icons/chains/rsz_hyperliquid?w=48&h=48'
  }

  const matchingChain = Object.entries(CHAIN_ID_MAP).find(([key]) => lowerChain.includes(key))
  if (!matchingChain) {
    return ''
  }

  const chainId = matchingChain[1]
  return `https://token-assets-one.vercel.app/api/chains/${chainId}/logo-32.png?fallback=true`
}

function extractSection(content: string, heading: string): string {
  const sections = content.split(/(?=^## )/m)
  const matchingSection = sections.find((section) => section.startsWith(`## ${heading}`))

  if (!matchingSection) {
    return ''
  }

  return matchingSection.split('\n').slice(1).join('\n').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseScoreTable(content: string): TCategoryScore[] {
  const tableMatch = content.match(/\| Category \| Score \| Weight \| Weighted \|[\s\S]*?(?=\n\n|\n[^|])/)
  if (tableMatch) {
    return tableMatch[0]
      .split('\n')
      .filter((row) => row.startsWith('|'))
      .slice(2)
      .map((row): TCategoryScore | undefined => {
        const cells = row
          .split('|')
          .map((cell) => cell.trim())
          .filter(Boolean)

        if (cells.length < 4) {
          return undefined
        }

        const category = cells[0].replaceAll('**', '')
        if (/final|weighted score|category-weighted/i.test(category)) {
          return undefined
        }

        return {
          category,
          score: Number.parseFloat(cells[1]) || 0,
          weight: cells[2],
          weighted: Number.parseFloat(cells[3]) || 0
        }
      })
      .filter((row): row is TCategoryScore => Boolean(row))
  }

  return FALLBACK_CATEGORY_PATTERNS.map((categoryConfig): TCategoryScore | undefined => {
    const safeCategoryName = escapeRegExp(categoryConfig.name)
    const pattern = new RegExp(`#{3,4}\\s*\\d*\\.?\\s*${safeCategoryName}[^\\n]*\\n\\*\\*Score:\\s*([\\d.]+)`, 'i')
    const match = content.match(pattern)
    if (!match) {
      return undefined
    }

    const score = Number.parseFloat(match[1])
    const weightRatio = Number.parseFloat(categoryConfig.weight) / 100

    return {
      category: categoryConfig.name,
      score,
      weight: categoryConfig.weight,
      weighted: Math.round(score * weightRatio * 1000) / 1000
    }
  }).filter((row): row is TCategoryScore => Boolean(row))
}

function parseMeta(slug: string, content: string): TReportMeta {
  const titleMatch = content.match(/^# (?:Protocol|Asset) Risk Assessment:\s*(.+)$/m)
  const name = titleMatch?.[1]?.trim() ?? slug

  const derivedType: TReportType = content.match(/^# Asset/m) ? 'Asset' : 'Protocol'
  const type = TYPE_OVERRIDES[slug] ?? derivedType

  const dateMatch = content.match(/\*\*Assessment Date:\*\*\s*(.+)/)
  const tokenMatch = content.match(/\*\*Token:\*\*\s*(.+)/)
  const chainMatch = content.match(/\*\*Chain:\*\*\s*(.+)/)
  const scoreMatch = content.match(/\*\*Final Score:\s*([\d.]+)\/5\.0\*\*/)

  const chain = chainMatch?.[1]?.trim() ?? ''
  const defillamaSlug = parseDefillamaSlug(slug, content)

  return {
    slug,
    name,
    date: dateMatch?.[1]?.trim() ?? '',
    token: tokenMatch?.[1]?.trim() ?? '',
    chain,
    finalScore: Number.parseFloat(scoreMatch?.[1] ?? '0'),
    type,
    iconUrl: getIconUrl(defillamaSlug),
    chainIconUrl: getChainIconUrl(chain)
  }
}

export function parseReport(slug: string, content: string): TReportData {
  const meta = parseMeta(slug, content)

  return {
    ...meta,
    overviewMarkdown: extractSection(content, 'Overview + Links'),
    scoreTable: parseScoreTable(content),
    riskSummaryMarkdown: extractSection(content, 'Risk Summary')
  }
}
