import { createServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { buildSessionEnv, isPortAvailable, resolveConfiguredApiRuntime } from './api-runtime.mjs'

const openServers = new Set<ReturnType<typeof createServer>>()

afterEach(async () => {
  await Promise.all(
    [...openServers].map(
      (server) =>
        new Promise((resolve) => {
          server.close(() => resolve(undefined))
        })
    )
  )
  openServers.clear()
})

describe('resolveConfiguredApiRuntime', () => {
  it('treats non-loopback API proxy targets as external APIs', () => {
    expect(resolveConfiguredApiRuntime({ API_PROXY_TARGET: 'https://staging.example.internal' })).toEqual({
      apiPort: 443,
      apiProxyTarget: 'https://staging.example.internal',
      isLocalApiTarget: false
    })
  })
})

describe('buildSessionEnv', () => {
  it('preserves explicit external API proxy targets without forcing a local API port', () => {
    expect(
      buildSessionEnv({
        apiPort: 443,
        apiProxyTarget: 'https://staging.example.internal',
        isLocalApiTarget: false,
        launcherEnv: {
          API_PORT: '3001',
          API_PROXY_TARGET: 'https://staging.example.internal'
        }
      })
    ).toEqual({
      API_PROXY_TARGET: 'https://staging.example.internal'
    })
  })
})

describe('isPortAvailable', () => {
  it('detects ports already claimed by another listener without relying on ss', async () => {
    const server = createServer()
    openServers.add(server)

    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, () => resolve(undefined))
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP server address')
    }

    expect(await isPortAvailable(address.port)).toBe(false)
  })
})
