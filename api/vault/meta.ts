import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load HTML at module level (happens once per container cold start)
const indexPath = join(process.cwd(), 'dist', 'index.html')
const baseHtml = readFileSync(indexPath, 'utf-8')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { chainId, address } = req.query

  if (!chainId || !address || typeof chainId !== 'string' || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid chainId or address' })
  }

  try {
    let html = baseHtml

    // Generate dynamic meta tags
    const ogBaseUrl = 'https://og.yearn.fi'
    const ogImageUrl = `${ogBaseUrl}/api/og/yearn/vault/${chainId}/${address}`
    const canonicalUrl = `https://yearn.fi/vaults-beta/${chainId}/${address}`

    const title = 'Yearn Vault'
    const description = "Earn yield on your crypto with Yearn's automated vault strategies"

    // Inject meta tags
    const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImageUrl}" />
    
    <!-- Additional SEO -->
    <link rel="canonical" href="${canonicalUrl}" />
    `

    // Remove existing meta tags that we're replacing
    html = html.replace(/<title>.*?<\/title>/gi, '')
    html = html.replace(/<meta property="og:.*?".*?>/gi, '')
    html = html.replace(/<meta name="twitter:.*?".*?>/gi, '')
    html = html.replace(/<meta name="description".*?>/gi, '')

    // Inject new meta tags
    html = html.replace('</head>', `${metaTags}\n  </head>`)

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')

    return res.status(200).send(html)
  } catch (error) {
    console.error('Error generating meta tags:', error)
    // Fallback to regular SPA with cached HTML
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    return res.status(200).send(baseHtml)
  }
}
