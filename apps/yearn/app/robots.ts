import type { MetadataRoute } from 'next'

const SITE_URL = 'https://yearn.fi'
const isBlockedDeployment = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development'

export default function robots(): MetadataRoute.Robots {
  if (isBlockedDeployment) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/'
      }
    }
  }

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/llms.txt', '/robots.txt', '/sitemap.xml', '/api/vaults/markdown', '/api/vault/markdown'],
      disallow: ['/api/enso/', '/api/holdings/', '/api/optimization/', '/api/tenderly/']
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  }
}
