import type { TTenderlyFundRequest } from '@/components/shared/types/tenderly'
import { ADMIN_POST_CORS_HEADERS, getRequestIp, json, noContent, readJsonBody } from '../http'
import { resolveTenderlyFundRpcRequest } from '../tenderly.helpers'
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
    const body = await readJsonBody<TTenderlyFundRequest>(request)
    const { method, params } = resolveTenderlyFundRpcRequest(body)
    const result = await callTenderlyAdminRpc(body.canonicalChainId, method, params)

    return json(
      {
        method,
        result
      },
      { headers: ADMIN_POST_CORS_HEADERS }
    )
  } catch (error) {
    console.error('Error funding Tenderly wallet:', error)
    return json(
      { error: error instanceof Error ? error.message : 'Failed to fund wallet on Tenderly' },
      { status: 400, headers: ADMIN_POST_CORS_HEADERS }
    )
  }
}

export default POST
