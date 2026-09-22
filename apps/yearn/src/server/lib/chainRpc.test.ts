import { afterEach, describe, expect, it, vi } from 'vitest'
import { getServerRpcOverride } from '@/server/lib/chainRpc'

afterEach(() => vi.unstubAllEnvs())
describe('server RPC precedence', () => {
  it('keeps private server overrides ahead of individual public variables', () => {
    vi.stubEnv('RPC_URI_FOR_4663', ' https://private.example ')
    vi.stubEnv('NEXT_PUBLIC_RPC_URI_FOR_4663', ' https://public.example ')
    expect(getServerRpcOverride(4663)).toBe('https://private.example')
    vi.stubEnv('RPC_URI_FOR_4663', ' ')
    expect(getServerRpcOverride(4663)).toBe('https://public.example')
    vi.stubEnv('NEXT_PUBLIC_RPC_URI_FOR_4663', '')
    expect(getServerRpcOverride(4663)).toBeUndefined()
  })
})
