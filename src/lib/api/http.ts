import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const

function mergeHeaders(headers?: HeadersInit): Headers {
  const mergedHeaders = new Headers(headers)

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    mergedHeaders.set(key, value)
  })

  return mergedHeaders
}

export function jsonResponse(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: mergeHeaders(init?.headers)
  })
}

export function optionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: mergeHeaders()
  })
}
