export const KONG_REST_BASE = (import.meta.env.VITE_KONG_REST_URL || 'https://kong.yearn.fi/api/rest').replace(
  /\/$/,
  ''
)

const derivedGqlBase = KONG_REST_BASE.endsWith('/api/rest')
  ? KONG_REST_BASE.replace(/\/api\/rest$/, '/api/gql')
  : 'https://kong.yearn.fi/api/gql'

export const KONG_GQL_BASE = (import.meta.env.VITE_KONG_GQL_URL || derivedGqlBase).replace(/\/$/, '')
