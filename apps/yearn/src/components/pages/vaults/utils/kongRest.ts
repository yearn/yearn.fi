import { env } from '@/env'
export const KONG_REST_BASE = (env.NEXT_PUBLIC_KONG_REST_URL || 'https://kong.yearn.fi/api/rest').replace(/\/$/, '')

const derivedGqlBase = KONG_REST_BASE.endsWith('/api/rest')
  ? KONG_REST_BASE.replace(/\/api\/rest$/, '/api/gql')
  : 'https://kong.yearn.fi/api/gql'

export const KONG_GQL_BASE = (env.NEXT_PUBLIC_KONG_GQL_URL || derivedGqlBase).replace(/\/$/, '')
