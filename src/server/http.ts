export type TQueryValue = string | string[] | undefined

export const GET_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

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

function simpleHash(value: string): string {
  const hash = Array.from(value).reduce((currentHash, char) => {
    const nextHash = (currentHash << 5) - currentHash + char.charCodeAt(0)
    return nextHash & nextHash
  }, 0)
  return Math.abs(hash).toString(36)
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || forwarded
  }

  const userAgent = request.headers.get('user-agent') || ''
  const acceptLanguage = request.headers.get('accept-language') || ''
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  return `fp-${simpleHash(userAgent + acceptLanguage + acceptEncoding)}`
}

export function getRequestIp(request: Request): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()

  return forwardedFor || realIp || (process.env.NODE_ENV === 'development' ? '127.0.0.1' : undefined)
}
