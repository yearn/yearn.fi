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
