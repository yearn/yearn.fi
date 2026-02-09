const CURVE_CANONICAL_HOST = 'www.curve.finance'
const CURVE_ALLOWED_HOSTS = new Set([CURVE_CANONICAL_HOST, 'curve.finance', 'curve.fi', 'www.curve.fi'])

export function normalizeCurveUrl(rawUrl: string): string {
  if (!rawUrl) {
    return ''
  }
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    if (host === 'curve.fi' || host === 'www.curve.fi' || host === 'curve.finance') {
      url.hostname = CURVE_CANONICAL_HOST
    }
    return url.toString()
  } catch {
    return ''
  }
}

export function isCurveHostUrl(rawUrl: string): boolean {
  if (!rawUrl) {
    return false
  }
  try {
    const host = new URL(rawUrl).hostname.toLowerCase()
    return CURVE_ALLOWED_HOSTS.has(host)
  } catch {
    return false
  }
}
