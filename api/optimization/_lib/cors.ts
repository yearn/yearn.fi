import type { VercelResponse } from '@vercel/node'

export const OPTIMIZATION_GET_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

export const OPTIMIZATION_POST_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

export function setCorsHeaders(res: VercelResponse, headers: Readonly<Record<string, string>>): VercelResponse {
  res.setHeader('Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin'])
  res.setHeader('Access-Control-Allow-Methods', headers['Access-Control-Allow-Methods'])
  res.setHeader('Access-Control-Allow-Headers', headers['Access-Control-Allow-Headers'])
  return res
}
