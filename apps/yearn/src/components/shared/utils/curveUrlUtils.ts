const CURVE_CANONICAL_HOST = 'www.curve.finance'
const CURVE_ALLOWED_HOSTS = new Set([CURVE_CANONICAL_HOST, 'curve.finance', 'curve.fi', 'www.curve.fi'])
const WEB_PROTOCOLS = new Set(['http:', 'https:'])

function parseWebUrl(rawUrl: string): URL | null {
  if (!rawUrl) {
    return null
  }
  try {
    const url = new URL(rawUrl)
    return WEB_PROTOCOLS.has(url.protocol) ? url : null
  } catch {
    return null
  }
}

export function normalizeCurveUrl(rawUrl: string): string {
  const url = parseWebUrl(rawUrl)
  if (!url) {
    return ''
  }

  const host = url.hostname.toLowerCase()
  if (host === 'curve.fi' || host === 'www.curve.fi' || host === 'curve.finance') {
    url.hostname = CURVE_CANONICAL_HOST
  }

  return url.toString()
}

export function isCurveHostUrl(rawUrl: string): boolean {
  const url = parseWebUrl(rawUrl)
  if (!url) {
    return false
  }

  const host = url.hostname.toLowerCase()
  return CURVE_ALLOWED_HOSTS.has(host)
}
