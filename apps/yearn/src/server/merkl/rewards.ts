import { GET_CORS_HEADERS, json, noContent, queryValue } from '@/server/http'

export const MERKL_API_BASE = 'https://api.merkl.xyz'
export const MERKL_REWARDS_CACHE_CONTROL = 'private, no-store, max-age=0, must-revalidate'

type TEnv = Record<string, string | undefined>
type TQueryParam = string | string[] | null | undefined

export type TMerklRewardsParams = {
  userAddress: `0x${string}`
  chainId: string
}

type TMerklRewardsValidationResult =
  | {
      ok: true
      params: TMerklRewardsParams
    }
  | {
      ok: false
      status: 400
      error: string
    }

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const CHAIN_ID_REGEX = /^\d+$/

const readSingleQueryParam = (value: TQueryParam): string | undefined => {
  return typeof value === 'string' ? value.trim() : undefined
}

export const getMerklApiKey = (env: TEnv = process.env): string => {
  return env.MERKL_API_KEY?.trim() ?? ''
}

export function validateMerklRewardsParams(
  userAddressParam: TQueryParam,
  chainIdParam: TQueryParam
): TMerklRewardsValidationResult {
  const userAddress = readSingleQueryParam(userAddressParam)
  const chainId = readSingleQueryParam(chainIdParam)

  if (!userAddress) {
    return { ok: false, status: 400, error: 'Missing userAddress' }
  }

  if (!EVM_ADDRESS_REGEX.test(userAddress)) {
    return { ok: false, status: 400, error: 'Invalid userAddress' }
  }

  if (!chainId) {
    return { ok: false, status: 400, error: 'Missing chainId' }
  }

  if (!CHAIN_ID_REGEX.test(chainId)) {
    return { ok: false, status: 400, error: 'Invalid chainId' }
  }

  return {
    ok: true,
    params: {
      userAddress: userAddress as `0x${string}`,
      chainId
    }
  }
}

export function buildMerklRewardsUrl(params: TMerklRewardsParams): string {
  const url = new URL(`/v4/users/${params.userAddress}/rewards`, MERKL_API_BASE)
  url.searchParams.set('chainId', params.chainId)
  return url.toString()
}

export const buildMerklRewardsHeaders = (apiKey: string): Record<string, string> => ({
  Accept: 'application/json',
  'X-API-Key': apiKey.trim()
})

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const validation = validateMerklRewardsParams(queryValue(request, 'userAddress'), queryValue(request, 'chainId'))
  if (!validation.ok) {
    return json({ error: validation.error }, { status: validation.status, headers: GET_CORS_HEADERS })
  }

  const apiKey = getMerklApiKey()
  if (!apiKey) {
    console.error('MERKL_API_KEY not configured')
    return json({ error: 'Merkl API not configured' }, { status: 500, headers: GET_CORS_HEADERS })
  }

  try {
    const response = await fetch(buildMerklRewardsUrl(validation.params), {
      headers: buildMerklRewardsHeaders(apiKey)
    })
    const responseBody = await response.text()

    if (!response.ok) {
      console.error(`Merkl API error: ${response.status}`, responseBody)
      return json(
        {
          error: 'Merkl API error',
          status: response.status,
          details: responseBody
        },
        { status: response.status, headers: GET_CORS_HEADERS }
      )
    }

    return new Response(responseBody, {
      status: 200,
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': MERKL_REWARDS_CACHE_CONTROL,
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error proxying Merkl rewards request:', error)
    return json({ error: 'Internal server error' }, { status: 500, headers: GET_CORS_HEADERS })
  }
}

export default GET
