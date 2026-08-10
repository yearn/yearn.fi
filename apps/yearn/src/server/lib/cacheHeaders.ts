export const CLIENT_REVALIDATE_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

type THeaderResponse = {
  setHeader(name: string, value: string): unknown
}

export function setVercelCdnCacheHeaders(res: THeaderResponse, cdnCacheControl: string): void {
  res.setHeader('Vercel-CDN-Cache-Control', cdnCacheControl)
  res.setHeader('Cache-Control', CLIENT_REVALIDATE_CACHE_CONTROL)
}

export function getVercelCdnCacheHeaders(cdnCacheControl: string): Record<string, string> {
  return {
    'Vercel-CDN-Cache-Control': cdnCacheControl,
    'Cache-Control': CLIENT_REVALIDATE_CACHE_CONTROL
  }
}
