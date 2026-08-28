import { env } from '@/env'
export const KONG_REST_BASE = (env.NEXT_PUBLIC_KONG_REST_URL || 'https://kong.yearn.fi/api/rest').replace(/\/$/, '')
