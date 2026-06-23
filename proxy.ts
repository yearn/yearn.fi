import { type NextRequest, NextResponse } from 'next/server'

const TENDERLY_API_PREFIX = '/api/tenderly'

export function shouldBlockTenderlyApiRequestInProduction({
  pathname,
  vercelEnv
}: {
  pathname: string
  vercelEnv: string | undefined
}): boolean {
  return (
    vercelEnv === 'production' && (pathname === TENDERLY_API_PREFIX || pathname.startsWith(`${TENDERLY_API_PREFIX}/`))
  )
}

export function proxy(request: NextRequest): Response {
  if (
    shouldBlockTenderlyApiRequestInProduction({
      pathname: request.nextUrl.pathname,
      vercelEnv: process.env.VERCEL_ENV
    })
  ) {
    return new Response(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/tenderly/:path*'
}
