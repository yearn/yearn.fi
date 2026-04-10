import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildSessionEnv,
  DEFAULT_API_CHANGE_PATHS,
  DEFAULT_API_ENV_CHANGE_PATHS,
  getApiChangePathsForMode,
  getEnvChangeEntriesSince,
  getRecordedApiCommittedChangeEntries,
  getRecordedApiRuntimeMismatchEntries,
  isPortAvailable,
  resolveConfiguredApiRuntime,
  resolveLauncherEnv,
  resolveLocalApiRuntimeOwner
} from './api-runtime.mjs'

const openServers = new Set<ReturnType<typeof createServer>>()
const tempDirs = new Set<string>()
const tempFiles = new Set<string>()

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
  tempFiles.forEach((file) => {
    rmSync(file, { force: true })
  })
  tempFiles.clear()
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

describe('getApiChangePathsForMode', () => {
  it('includes only development env files for development launcher reuse detection', () => {
    expect(getApiChangePathsForMode('development')).toEqual(
      expect.arrayContaining([
        ...DEFAULT_API_CHANGE_PATHS,
        ...DEFAULT_API_ENV_CHANGE_PATHS,
        '.env.development',
        '.env.development.local'
      ])
    )
    expect(getApiChangePathsForMode('development')).not.toEqual(
      expect.arrayContaining(['.env.production', '.env.production.local'])
    )
  })

  it('includes only production env files for production launcher reuse detection', () => {
    expect(getApiChangePathsForMode('production')).toEqual(
      expect.arrayContaining([
        ...DEFAULT_API_CHANGE_PATHS,
        ...DEFAULT_API_ENV_CHANGE_PATHS,
        '.env.production',
        '.env.production.local'
      ])
    )
    expect(getApiChangePathsForMode('production')).not.toEqual(
      expect.arrayContaining(['.env.development', '.env.development.local'])
    )
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

describe('getRecordedApiRuntimeMismatchEntries', () => {
  it('flags running APIs that were started in a different launcher mode', () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'yearn-api-runtime-workspace-'))
    tempDirs.add(workspacePath)
    const port = 3001
    const statePath = join(
      tmpdir(),
      'yearn-api-runtime',
      `${createHash('sha1').update(workspacePath).digest('hex')}-${port}.json`
    )
    tempFiles.add(statePath)
    mkdirSync(join(tmpdir(), 'yearn-api-runtime'), { recursive: true })

    writeFileSync(
      statePath,
      JSON.stringify({
        pid: 1234,
        mode: 'production',
        head: 'abc123',
        startedAtMs: 1_710_000_000_000
      })
    )

    expect(
      getRecordedApiRuntimeMismatchEntries({
        workspacePath,
        port,
        pid: 1234,
        mode: 'development',
        processStartedAtMs: 1_710_000_000_000
      })
    ).toEqual(['M the running API was started in production mode, not development'])
  })

  it('does not treat a different git checkout as a runtime mismatch by itself', () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'yearn-api-runtime-workspace-'))
    tempDirs.add(workspacePath)
    const port = 3001
    const statePath = join(
      tmpdir(),
      'yearn-api-runtime',
      `${createHash('sha1').update(workspacePath).digest('hex')}-${port}.json`
    )
    tempFiles.add(statePath)
    mkdirSync(join(tmpdir(), 'yearn-api-runtime'), { recursive: true })

    writeFileSync(
      statePath,
      JSON.stringify({
        pid: 1234,
        mode: 'development',
        head: 'old-head',
        startedAtMs: 1_710_000_000_000
      })
    )

    expect(
      getRecordedApiRuntimeMismatchEntries({
        workspacePath,
        port,
        pid: 1234,
        mode: 'development',
        processStartedAtMs: 1_710_000_000_000
      })
    ).toEqual([])
  })
})

describe('getRecordedApiCommittedChangeEntries', () => {
  it('ignores HEAD changes when API-tracked paths are unchanged', () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'yearn-api-runtime-workspace-'))
    tempDirs.add(workspacePath)
    const port = 3001
    const statePath = join(
      tmpdir(),
      'yearn-api-runtime',
      `${createHash('sha1').update(workspacePath).digest('hex')}-${port}.json`
    )
    tempFiles.add(statePath)
    mkdirSync(join(tmpdir(), 'yearn-api-runtime'), { recursive: true })

    writeFileSync(
      statePath,
      JSON.stringify({
        pid: 1234,
        mode: 'development',
        head: 'old-head',
        startedAtMs: 1_710_000_000_000
      })
    )

    expect(
      getRecordedApiCommittedChangeEntries({
        workspacePath,
        port,
        currentHead: 'new-head',
        changePaths: ['api', '.env.development'],
        runCommandImpl: () => ({
          pid: 1,
          status: 0,
          stdout: '',
          stderr: '',
          output: ['', '', ''],
          signal: null
        })
      })
    ).toEqual([])
  })

  it('flags committed API-path changes since the running API started', () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'yearn-api-runtime-workspace-'))
    tempDirs.add(workspacePath)
    const port = 3001
    const statePath = join(
      tmpdir(),
      'yearn-api-runtime',
      `${createHash('sha1').update(workspacePath).digest('hex')}-${port}.json`
    )
    tempFiles.add(statePath)
    mkdirSync(join(tmpdir(), 'yearn-api-runtime'), { recursive: true })

    writeFileSync(
      statePath,
      JSON.stringify({
        pid: 1234,
        mode: 'development',
        head: 'old-head',
        startedAtMs: 1_710_000_000_000
      })
    )

    expect(
      getRecordedApiCommittedChangeEntries({
        workspacePath,
        port,
        currentHead: 'new-head',
        changePaths: ['api', '.env.development'],
        runCommandImpl: () => ({
          pid: 1,
          status: 0,
          stdout: 'M\tapi/server.ts\n',
          stderr: '',
          output: ['', '', ''],
          signal: null
        })
      })
    ).toEqual(['M\tapi/server.ts'])
  })
})

describe('resolveLocalApiRuntimeOwner', () => {
  it('records the actual API listener pid instead of the wrapper pid', async () => {
    const healthChecks = [
      { ok: false, error: new Error('not ready') },
      { ok: true, status: 400 }
    ]

    await expect(
      resolveLocalApiRuntimeOwner({
        apiPort: 3001,
        apiProxyTarget: 'http://localhost:3001',
        checkApiHealthImpl: async () => healthChecks.shift() || { ok: true, status: 400 },
        inspectPortOwnerImpl: () => ({ pid: 4321, command: 'bun', workspacePath: '/tmp/yearn-fi' }),
        readProcessStartedAtMsImpl: () => 1_710_000_000_000,
        pollIntervalMs: 0
      })
    ).resolves.toEqual({
      pid: 4321,
      startedAtMs: 1_710_000_000_000
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
