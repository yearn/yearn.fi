const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function normalizeHostCandidate(value: string | null): string | undefined {
  const candidate = value?.split(',')[0]?.trim()
  if (!candidate) {
    return undefined
  }

  try {
    return new URL(`http://${candidate}`).hostname
  } catch {
    return undefined
  }
}

export function isLoopbackHostname(hostname: string | undefined): boolean {
  return typeof hostname === 'string' && LOOPBACK_HOSTNAMES.has(hostname)
}

export function isTenderlyAdminRequestAllowed(req: Request): boolean {
  const url = new URL(req.url)
  if (isLoopbackHostname(url.hostname)) {
    return true
  }

  return isLoopbackHostname(normalizeHostCandidate(req.headers.get('x-forwarded-host')))
}

export function buildTenderlyAdminAccessDeniedResponse(req: Request): Response | undefined {
  if (isTenderlyAdminRequestAllowed(req)) {
    return undefined
  }

  return Response.json({ error: 'Tenderly admin routes are only available from localhost' }, { status: 403 })
}
