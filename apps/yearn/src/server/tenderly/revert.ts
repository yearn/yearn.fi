import type { TTenderlyRevertRequest } from '@/components/shared/types/tenderly'
import { ADMIN_POST_CORS_HEADERS, getRequestIp, json, noContent, readJsonBody } from '../http'
import { buildTenderlyRevertResponse } from '../tenderly.helpers'
import { buildTenderlyAdminAccessDeniedResponse } from '../tenderlyAccess'
import { callTenderlyAdminRpc } from './rpc'

export function OPTIONS(): Response {
  return noContent(ADMIN_POST_CORS_HEADERS)
}

export async function POST(request: Request): Promise<Response> {
  const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(getRequestIp(request))
  if (accessDeniedResponse) {
    return accessDeniedResponse
  }

  try {
    const body = await readJsonBody<TTenderlyRevertRequest>(request)
    const result = await callTenderlyAdminRpc(body.canonicalChainId, 'evm_revert', [body.snapshotId])

    return json(buildTenderlyRevertResponse(result, body.snapshotId), { headers: ADMIN_POST_CORS_HEADERS })
  } catch (error) {
    console.error('Error reverting Tenderly snapshot:', error)
    return json(
      { error: error instanceof Error ? error.message : 'Failed to revert Tenderly snapshot' },
      { status: 400, headers: ADMIN_POST_CORS_HEADERS }
    )
  }
}

export default POST
