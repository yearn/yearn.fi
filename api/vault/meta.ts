import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'fs'
import { join } from 'path'

const HTML_ESCAPE_LOOKUP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

const CHAIN_ID_PATTERN = /^\d+$/
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

function escapeHtmlAttr(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_LOOKUP[char] ?? char)
}

function normalizeChainId(chainId: string): string | null {
  const trimmed = chainId.trim()
  if (!CHAIN_ID_PATTERN.test(trimmed)) {
    return null
  }
  return trimmed.replace(/^0+(?!$)/, '')
}

function normalizeAddress(address: string): string | null {
  const trimmed = address.trim()
  if (!ADDRESS_PATTERN.test(trimmed)) {
    return null
  }
  return trimmed.toLowerCase()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { chainId, address } = req.query

  if (!chainId || !address || typeof chainId !== 'string' || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid chainId or address' })
  }

  const normalizedChainId = normalizeChainId(chainId)
  const normalizedAddress = normalizeAddress(address)

  if (!normalizedChainId || !normalizedAddress) {
    return res.status(400).json({ error: 'Missing or invalid chainId or address' })
  }

  try {
    // Read the built index.html
    const indexPath = join(process.cwd(), 'dist', 'index.html')
    let html = readFileSync(indexPath, 'utf-8')

    // Generate dynamic meta tags
    const ogBaseUrl = 'https://og.yearn.fi'
    const ogImageUrl = `${ogBaseUrl}/api/og/yearn/vault/${encodeURIComponent(normalizedChainId)}/${encodeURIComponent(normalizedAddress)}`
    const canonicalUrl = `https://yearn.fi/v3/${encodeURIComponent(normalizedChainId)}/${encodeURIComponent(normalizedAddress)}`

    const title = 'Yearn Vault'
    const description = "Earn yield on your crypto with Yearn's automated vault strategies"

    // Inject meta tags
    const metaTags = `
    <title>${escapeHtmlAttr(title)}</title>
    <meta name="description" content="${escapeHtmlAttr(description)}" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="${escapeHtmlAttr(title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(description)}" />
    <meta property="og:image" content="${escapeHtmlAttr(ogImageUrl)}" />
    <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(ogImageUrl)}" />
    
    <!-- Additional SEO -->
    <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />
    `

    // Remove existing meta tags that we're replacing
    html = html.replace(/<title>.*?<\/title>/gi, '')
    html = html.replace(/<meta property="og:.*?".*?>/gi, '')
    html = html.replace(/<meta name="twitter:.*?".*?>/gi, '')
    html = html.replace(/<meta name="description".*?>/gi, '')

    // Inject new meta tags
    html = html.replace('</head>', `${metaTags}\n  </head>`)

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')

    return res.status(200).send(html)
  } catch (error) {
    console.error('Error generating meta tags:', error)

    // Fallback to regular SPA
    try {
      const indexPath = join(process.cwd(), 'dist', 'index.html')
      const html = readFileSync(indexPath, 'utf-8')
      res.setHeader('Content-Type', 'text/html')
      return res.status(200).send(html)
    } catch (_fallbackError) {
      return res.status(500).json({ error: 'Failed to serve page' })
    }
  }
}
