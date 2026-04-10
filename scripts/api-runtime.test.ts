import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildSessionEnv,
  DEFAULT_API_CHANGE_PATHS,
  DEFAULT_API_ENV_CHANGE_PATHS,
  getEnvChangeEntriesSince,
  isPortAvailable,
  resolveConfiguredApiRuntime,
  resolveLauncherEnv
} from './api-runtime.mjs'

const openServers = new Set<ReturnType<typeof createServer>>()
const tempDirs = new Set<string>()

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
  tempDirs.forEach((dir) => {
    rmSync(dir, { recursive: true, force: true })
  })
  tempDirs.clear()
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

describe('resolveLauncherEnv', () => {
  it('uses Vite env semantics, including mode-specific files and variable expansion', () => {
    const envDir = mkdtempSync(join(tmpdir(), 'yearn-api-runtime-'))
    tempDirs.add(envDir)
    const apiPortPlaceholder = '${' + 'API_PORT}'

    writeFileSync(join(envDir, '.env'), `API_PORT=3001\nVITE_API_PROXY_TARGET=http://localhost:${apiPortPlaceholder}\n`)
    writeFileSync(join(envDir, '.env.local'), 'VITE_API_PROXY_TARGET=http://localhost:3002\n')
    writeFileSync(join(envDir, '.env.production'), 'API_PORT=3003\n')
    writeFileSync(
      join(envDir, '.env.production.local'),
      `API_PORT=3007\nVITE_API_PROXY_TARGET=http://localhost:${apiPortPlaceholder}\n`
    )

    expect(resolveLauncherEnv('production', { envDir, shellEnv: {} }).VITE_API_PROXY_TARGET).toBe(
      'http://localhost:3007'
    )
  })
})

describe('DEFAULT_API_CHANGE_PATHS', () => {
  it('includes the env files that affect API runtime selection', () => {
    expect(DEFAULT_API_CHANGE_PATHS).toEqual(expect.arrayContaining(DEFAULT_API_ENV_CHANGE_PATHS))
  })
})

describe('getEnvChangeEntriesSince', () => {
  it('flags loaded env files that are newer than the running API process', () => {
    const envDir = mkdtempSync(join(tmpdir(), 'yearn-api-runtime-'))
    tempDirs.add(envDir)
    const processStartedAtMs = new Date('2026-04-10T17:00:00.000Z').getTime()
    const olderEnvPath = join(envDir, '.env')
    const newerEnvPath = join(envDir, '.env.development.local')

    writeFileSync(olderEnvPath, 'API_PORT=3001\n')
    writeFileSync(newerEnvPath, 'API_PORT=3007\n')
    utimesSync(olderEnvPath, new Date(processStartedAtMs - 60_000), new Date(processStartedAtMs - 60_000))
    utimesSync(newerEnvPath, new Date(processStartedAtMs + 60_000), new Date(processStartedAtMs + 60_000))

    expect(getEnvChangeEntriesSince('development', processStartedAtMs, envDir)).toEqual([
      'M .env.development.local (newer than the running API process)'
    ])
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
