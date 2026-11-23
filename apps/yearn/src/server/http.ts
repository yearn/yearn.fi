export type TQueryValue = string | string[] | undefined

export const GET_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

export const WALLET_SCOPED_CACHE_CONTROL = 'private, no-store, max-age=0, must-revalidate'

export const POST_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

export const ADMIN_POST_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret'
} as const

function mergeHeaders(...headerRecords: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers()
  headerRecords.forEach((headerRecord) => {
    if (!headerRecord) {
      return
    }

    new Headers(headerRecord).forEach((value, key) => {
      headers.set(key, value)
    })
  })
  return headers
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: mergeHeaders(init?.headers)
  })
}

export function noContent(headers: HeadersInit = GET_CORS_HEADERS): Response {
  return new Response(null, {
    status: 204,
    headers
  })
}

export function queryValue(request: Request, key: string): TQueryValue {
  const values = new URL(request.url).searchParams.getAll(key)
  if (values.length === 0) {
    return undefined
  }

  return values.length === 1 ? values[0] : values
}

export function queryString(request: Request, key: string): string | undefined {
  const value = queryValue(request, key)
  return typeof value === 'string' ? value : undefined
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch (_error) {
    throw new Error('Invalid JSON body')
  }
}

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

const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const LOOPBACK_BIND_HOSTNAMES = new Set(['127.0.0.1', '[::1]'])

function isDevServerBoundToLoopback(): boolean {
  return URL.canParse(process.env.__NEXT_PRIVATE_ORIGIN ?? '')
    ? LOOPBACK_BIND_HOSTNAMES.has(new URL(process.env.__NEXT_PRIVATE_ORIGIN as string).hostname)
    : false
}

export function getRequestIp(request: Request): string | undefined {
  if (process.env.VERCEL) {
    return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || undefined
  }

  const isLocalHost = LOCAL_HOST_PATTERN.test(request.headers.get('host') ?? '')
  if (process.env.NODE_ENV !== 'development' || !isLocalHost || !isDevServerBoundToLoopback()) {
    return undefined
  }

  const hops = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)
  return hops.find((hop) => !isLoopbackAddress(hop)) ?? hops.at(-1)
}
