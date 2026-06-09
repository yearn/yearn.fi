const LOOPBACK_ADDRESSES = new Set(['localhost', '::1'])
const TENDERLY_ADMIN_ORIGIN_DEFAULTS = ['http://localhost:3000', 'http://127.0.0.1:3000']

export const TENDERLY_ADMIN_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret'
}

function readCsvValues(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  )
}

function getTenderlyAdminAllowedOrigins(): Set<string> {
  return new Set([...TENDERLY_ADMIN_ORIGIN_DEFAULTS, ...readCsvValues(process.env.TENDERLY_ADMIN_ALLOWED_ORIGINS)])
}

function isLoopbackIpv4(address: string): boolean {
  const octets = address.split('.')
  if (octets.length !== 4) {
    return false
  }

  return (
    octets[0] === '127' &&
    octets.every((octet) => {
      if (!/^\d+$/.test(octet)) {
        return false
      }

      const value = Number(octet)
      return value >= 0 && value <= 255
    })
  )
}

export function isLoopbackAddress(address: string | null | undefined): boolean {
  if (typeof address !== 'string') {
    return false
  }

  if (LOOPBACK_ADDRESSES.has(address) || isLoopbackIpv4(address)) {
    return true
  }

  if (address.startsWith('::ffff:')) {
    return isLoopbackIpv4(address.slice('::ffff:'.length))
  }

  return false
}

export function isTenderlyAdminRequestAllowed(requestIpAddress: string | null | undefined): boolean {
  return isLoopbackAddress(requestIpAddress)
}

export function isTenderlyAdminOriginAllowed(origin: string | null): boolean {
  return origin === null || getTenderlyAdminAllowedOrigins().has(origin)
}

export function getTenderlyAdminSecret(): string | undefined {
  return process.env.TENDERLY_ADMIN_SECRET || process.env.ADMIN_SECRET
}

export function buildTenderlyAdminAccessDeniedResponse(
  requestIpAddress: string | null | undefined,
  req?: Request
): Response | undefined {
  if (req && !isTenderlyAdminOriginAllowed(req.headers.get('Origin'))) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  }

  if (isTenderlyAdminRequestAllowed(requestIpAddress)) {
    const adminSecret = getTenderlyAdminSecret()
    if (!adminSecret) {
      return Response.json({ error: 'Tenderly admin endpoint not configured' }, { status: 503 })
    }

    if (req?.headers.get('x-admin-secret') === adminSecret) {
      return undefined
    }

    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json({ error: 'Tenderly admin routes are only available from localhost' }, { status: 403 })
}

export function buildTenderlyAdminCorsPreflightResponse(req: Request): Response {
  const origin = req.headers.get('Origin')
  if (!isTenderlyAdminOriginAllowed(origin)) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  }

  return new Response(null, {
    status: 204,
    headers: origin
      ? {
          ...TENDERLY_ADMIN_CORS_HEADERS,
          'Access-Control-Allow-Origin': origin,
          Vary: 'Origin'
        }
      : TENDERLY_ADMIN_CORS_HEADERS
  })
}

export function withTenderlyAdminCors(response: Response, req: Request): Response {
  const origin = req.headers.get('Origin')
  const newHeaders = new Headers(response.headers)

  newHeaders.delete('Access-Control-Allow-Origin')
  newHeaders.delete('Access-Control-Allow-Credentials')

  Object.entries(TENDERLY_ADMIN_CORS_HEADERS).forEach(([key, value]) => {
    newHeaders.set(key, value)
  })

  if (isTenderlyAdminOriginAllowed(origin) && origin) {
    newHeaders.set('Access-Control-Allow-Origin', origin)
    newHeaders.set('Vary', 'Origin')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  })
}
