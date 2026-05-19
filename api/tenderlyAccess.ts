const LOOPBACK_ADDRESSES = new Set(['localhost', '::1'])

type TTenderlyAdminAccessRequest = {
  adminSecret: string | null | undefined
  providedSecret: string | null | undefined
  requestHost?: string | null | undefined
  requestIpAddress: string | null | undefined
  requestOrigin: string | null | undefined
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

function parseHostname(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }

  try {
    const parsed = new URL(value.includes('://') ? value : `http://${value}`)
    return parsed.hostname.replace(/^\[(.*)\]$/, '$1')
  } catch (_error) {
    return undefined
  }
}

export function isLoopbackOrigin(origin: string | null | undefined, requestHost?: string | null | undefined): boolean {
  if (typeof origin !== 'string' || origin.trim().length === 0) {
    return true
  }

  const originHostname = parseHostname(origin)
  const requestHostname = parseHostname(requestHost)
  return Boolean(originHostname && (isLoopbackAddress(originHostname) || originHostname === requestHostname))
}

function readSecret(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isTenderlyAdminRequestAllowed(request: TTenderlyAdminAccessRequest): boolean {
  const adminSecret = readSecret(request.adminSecret)
  return (
    isLoopbackAddress(request.requestIpAddress) &&
    isLoopbackOrigin(request.requestOrigin, request.requestHost) &&
    adminSecret.length > 0 &&
    readSecret(request.providedSecret) === adminSecret
  )
}

export function buildTenderlyAdminAccessDeniedResponse(request: TTenderlyAdminAccessRequest): Response | undefined {
  if (isTenderlyAdminRequestAllowed(request)) {
    return undefined
  }

  if (!isLoopbackAddress(request.requestIpAddress)) {
    return Response.json({ error: 'Tenderly admin routes are only available from localhost' }, { status: 403 })
  }

  if (!isLoopbackOrigin(request.requestOrigin, request.requestHost)) {
    return Response.json({ error: 'Tenderly admin requests must come from a localhost origin' }, { status: 403 })
  }

  if (readSecret(request.adminSecret).length === 0) {
    return Response.json({ error: 'Tenderly admin routes require TENDERLY_ADMIN_SECRET' }, { status: 503 })
  }

  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
