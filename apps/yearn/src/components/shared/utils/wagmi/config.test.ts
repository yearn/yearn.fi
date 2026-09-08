import { describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'

describe('registered Wagmi config', () => {
  it('returns the exact registered config instance', async () => {
    vi.resetModules()
    const { registerConfig, retrieveConfig } = await import('@shared/utils/wagmi/config')
    const config = { id: 'wagmi-config' } as unknown as Config

    registerConfig(config)

    expect(retrieveConfig()).toBe(config)
  })

  it('fails clearly before a config is registered', async () => {
    vi.resetModules()
    const { retrieveConfig } = await import('@shared/utils/wagmi/config')

    expect(() => retrieveConfig()).toThrow('Config not set')
  })
})
