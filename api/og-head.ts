import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { RouteMeta } from '../apps/lib/utils/ogMeta'
import { resolveRouteMeta, selectManifest } from '../apps/lib/utils/ogMeta'

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host || 'yearn.fi') as string
  const protocol = (req.headers['x-forwarded-proto'] || 'https') as string
  const origin = `${protocol}://${hostHeader}`
  const requestUrl = new URL(req.url ?? '/', origin)
  const pathname = requestUrl.pathname

  const routeMeta = buildMeta({ pathname, origin })

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400')
  res.status(200).send(renderDocument(routeMeta))
}

function buildMeta({ pathname, origin }: { pathname: string; origin: string }): RouteMeta {
  const manifest = selectManifest(pathname)
  return resolveRouteMeta({ pathname, manifest, origin })
}

function renderDocument(meta: RouteMeta): string {
  const escapedTitle = escapeHtml(meta.title)
  const escapedDescription = escapeHtml(meta.description)
  const escapedUrl = escapeHtml(meta.uri)
  const escapedOg = escapeHtml(meta.og)
  const escapedTheme = escapeHtml(meta.themeColor)
  const escapedTwitter = escapeHtml(meta.twitterHandle)

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}" />
    <meta name="theme-color" content="${escapedTheme}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapedUrl}" />
    <meta property="og:image" content="${escapedOg}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:image" content="${escapedOg}" />
    <meta name="twitter:site" content="${escapedTwitter}" />
    <link rel="canonical" href="${escapedUrl}" />
  </head>
  <body>
    <noscript>
      <meta http-equiv="refresh" content="0;url=${escapedUrl}" />
    </noscript>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}
