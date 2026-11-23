import { ADMIN_POST_CORS_HEADERS, isLoopbackAddress } from './http'

export function isTenderlyAdminRequestAllowed(requestIpAddress: string | null | undefined): boolean {
  return isLoopbackAddress(requestIpAddress)
}

export function buildTenderlyAdminAccessDeniedResponse(
  requestIpAddress: string | null | undefined
): Response | undefined {
  if (isTenderlyAdminRequestAllowed(requestIpAddress)) {
    return undefined
  }

  return Response.json(
    { error: 'Tenderly admin routes are only available from localhost' },
    { status: 403, headers: ADMIN_POST_CORS_HEADERS }
  )
}
