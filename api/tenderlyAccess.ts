const LOOPBACK_ADDRESSES = new Set(['localhost', '::1'])

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

export function buildTenderlyAdminAccessDeniedResponse(
  requestIpAddress: string | null | undefined
): Response | undefined {
  if (isTenderlyAdminRequestAllowed(requestIpAddress)) {
    return undefined
  }

  return Response.json({ error: 'Tenderly admin routes are only available from localhost' }, { status: 403 })
}
