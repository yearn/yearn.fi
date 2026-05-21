import type { VercelResponse } from '@vercel/node'

const DEFAULT_TRUSTED_ORIGINS = [
  'https://yearn.fi',
  'https://www.yearn.fi',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
] as const

export const OPTIMIZATION_GET_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

export const OPTIMIZATION_POST_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

function getConfiguredTrustedOrigins(): string[] {
  return (process.env.OPTIMIZATION_CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function isTrustedOptimizationOrigin(origin: string | null | undefined): origin is string {
  if (!origin) {
    return false
  }

  return new Set([...DEFAULT_TRUSTED_ORIGINS, ...getConfiguredTrustedOrigins()]).has(origin)
}

export function getOptimizationCorsHeaders(
  origin: string | null | undefined,
  headers: Readonly<Record<string, string>>
): Record<string, string> {
  if (!isTrustedOptimizationOrigin(origin)) {
    return {}
  }

  return {
    'Access-Control-Allow-Origin': origin,
    ...headers
  }
}

function getVercelOriginHeader(origin: string | string[] | undefined): string | undefined {
  return Array.isArray(origin) ? origin[0] : origin
}

export function setCorsHeaders(
  res: VercelResponse,
  headers: Readonly<Record<string, string>>,
  origin: string | string[] | undefined
): VercelResponse {
  Object.entries(getOptimizationCorsHeaders(getVercelOriginHeader(origin), headers)).forEach(([name, value]) => {
    res.setHeader(name, value)
  })

  return res
}
