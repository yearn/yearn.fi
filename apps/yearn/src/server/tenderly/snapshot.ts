import type { TTenderlySnapshotRequest } from '@/components/shared/types/tenderly'
import { ADMIN_POST_CORS_HEADERS, getRequestIp, json, noContent, readJsonBody } from '../http'
import { buildTenderlySnapshotRecord, requireTenderlyServerChain } from '../tenderly.helpers'
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
    const body = await readJsonBody<TTenderlySnapshotRequest>(request)
    const configuredChain = requireTenderlyServerChain(process.env, body.canonicalChainId)
    const snapshotId = await callTenderlyAdminRpc(body.canonicalChainId, 'evm_snapshot', [])
    const snapshotRecord = buildTenderlySnapshotRecord({
      canonicalChainId: body.canonicalChainId,
      executionChainId: configuredChain.executionChainId,
      snapshotId: String(snapshotId),
      label: body.label,
      isBaseline: body.isBaseline
    })

    return json(snapshotRecord, { headers: ADMIN_POST_CORS_HEADERS })
  } catch (error) {
    console.error('Error creating Tenderly snapshot:', error)
    return json(
      { error: error instanceof Error ? error.message : 'Failed to create Tenderly snapshot' },
      { status: 400, headers: ADMIN_POST_CORS_HEADERS }
    )
  }
}

export default POST
