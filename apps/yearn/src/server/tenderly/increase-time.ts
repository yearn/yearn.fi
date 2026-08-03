import type { TTenderlyIncreaseTimeRequest } from '@/components/shared/types/tenderly'
import { ADMIN_POST_CORS_HEADERS, getRequestIp, json, noContent, readJsonBody } from '../http'
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
    const body = await readJsonBody<TTenderlyIncreaseTimeRequest>(request)
    if (!Number.isInteger(body.seconds) || body.seconds <= 0) {
      throw new Error('seconds must be a positive integer')
    }

    const timeResult = await callTenderlyAdminRpc(body.canonicalChainId, 'evm_increaseTime', [
      `0x${BigInt(body.seconds).toString(16)}`
    ])
    const mineResult = body.mineBlock ? await callTenderlyAdminRpc(body.canonicalChainId, 'evm_mine', []) : undefined

    return json(
      {
        timeResult,
        mineResult
      },
      { headers: ADMIN_POST_CORS_HEADERS }
    )
  } catch (error) {
    console.error('Error increasing Tenderly time:', error)
    return json(
      { error: error instanceof Error ? error.message : 'Failed to increase Tenderly time' },
      { status: 400, headers: ADMIN_POST_CORS_HEADERS }
    )
  }
}

export default POST
