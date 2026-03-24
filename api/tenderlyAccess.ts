const LOOPBACK_ADDRESSES = new Set(['localhost', '127.0.0.1', '::1'])

export function isLoopbackAddress(address: string | null | undefined): boolean {
  return typeof address === 'string' && LOOPBACK_ADDRESSES.has(address)
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
