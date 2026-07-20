export const CLIENT_REVALIDATE_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

export function getVercelCdnCacheHeaders(cdnCacheControl: string): Record<string, string> {
  return {
    'Vercel-CDN-Cache-Control': cdnCacheControl,
    'Cache-Control': CLIENT_REVALIDATE_CACHE_CONTROL
  }
}
