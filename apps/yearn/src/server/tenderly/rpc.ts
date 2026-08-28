import { requireTenderlyServerChain } from '../tenderly.helpers'

type TTenderlyJsonRpcSuccess = {
  id: string | number | null
  jsonrpc: '2.0'
  result: unknown
}

type TTenderlyJsonRpcError = {
  id: string | number | null
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export async function callTenderlyAdminRpc(
  canonicalChainId: number,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const configuredChain = requireTenderlyServerChain(process.env, canonicalChainId)
  const response = await fetch(configuredChain.adminRpcUri as string, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method,
      params
    })
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Tenderly RPC request failed with status ${response.status}: ${details}`)
  }

  const payload = (await response.json()) as TTenderlyJsonRpcSuccess | TTenderlyJsonRpcError
  if ('error' in payload) {
    throw new Error(`${payload.error.message} (code ${payload.error.code})`)
  }

  return payload.result
}
