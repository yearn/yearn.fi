import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'fs'
import { join } from 'path'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { chainId, address } = req.query

  if (!chainId || !address || typeof chainId !== 'string' || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid chainId or address' })
  }

  try {
    // Read the built index.html
    const indexPath = join(process.cwd(), 'dist', 'index.html')
    let html = readFileSync(indexPath, 'utf-8')

    // Generate dynamic meta tags
    const ogBaseUrl = 'https://og.yearn.fi'
    const ogImageUrl = `${ogBaseUrl}/api/og/yearn/vault/${chainId}/${address}`
    const canonicalUrl = `https://yearn.fi/v3/${chainId}/${address}`
    
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
    } catch (fallbackError) {
      return res.status(500).json({ error: 'Failed to serve page' })
    }
  }
}