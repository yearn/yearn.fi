import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { cwd, env, exit, stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'

const DEFAULT_API_PORT = 3001
const API_HEALTHCHECK_PATH = '/api/enso/balances'
const API_HEALTHCHECK_EXPECTED_ERROR = 'Missing eoaAddress'
const API_HEALTHCHECK_TIMEOUT_MS = 500

export const DEFAULT_API_CHANGE_PATHS = [
  'api',
  'vite.config.ts',
  'scripts/ensure-api-server.js',
  'scripts/api-runtime.mjs',
  'package.json'
]

function resolveRealPath(path) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

function parseEnvFile(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=')
        const key = line.slice(0, separatorIndex).trim()
        const rawValue = line.slice(separatorIndex + 1).trim()
        const value = rawValue.replace(/^['"]|['"]$/g, '')

        return [key, value]
      })
      .filter(([key]) => Boolean(key))
  )
}

function readOptionalEnvFile(path) {
  if (!existsSync(path)) {
    return {}
  }

  return parseEnvFile(readFileSync(path, 'utf8'))
}

function resolveLauncherEnv() {
  return {
    ...readOptionalEnvFile('.env'),
    ...readOptionalEnvFile('.env.local'),
    ...Object.fromEntries(Object.entries(env).filter((entry) => typeof entry[1] === 'string'))
  }
}

function normalizePort(portValue, fallbackPort = DEFAULT_API_PORT) {
  const port = Number(portValue)
  return Number.isInteger(port) && port > 0 ? port : fallbackPort
}

function resolveConfiguredApiRuntime(launcherEnv) {
  const explicitTarget = launcherEnv.API_PROXY_TARGET?.trim() || launcherEnv.VITE_API_PROXY_TARGET?.trim()

  if (explicitTarget) {
    try {
      const parsedTarget = new URL(explicitTarget)
      const inferredPort = normalizePort(
        parsedTarget.port || (parsedTarget.protocol === 'https:' ? '443' : '80'),
        DEFAULT_API_PORT
      )

      return {
        apiPort: inferredPort,
        apiProxyTarget: explicitTarget.replace(/\/$/, '')
      }
    } catch {
      return {
        apiPort: DEFAULT_API_PORT,
        apiProxyTarget: `http://localhost:${DEFAULT_API_PORT}`
      }
    }
  }

  const configuredPort = normalizePort(
    launcherEnv.API_PORT?.trim() || launcherEnv.VITE_API_PORT?.trim(),
    DEFAULT_API_PORT
  )

  return {
    apiPort: configuredPort,
    apiProxyTarget: `http://localhost:${configuredPort}`
  }
}

function describeCommandOwner(commandOwner) {
  if (!commandOwner) {
    return 'unknown process'
  }

  const ownerWorkspace = commandOwner.workspacePath ? ` in ${commandOwner.workspacePath}` : ''
  return `${commandOwner.command} (pid ${commandOwner.pid})${ownerWorkspace}`
}

async function checkApiHealth(apiProxyTarget) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_HEALTHCHECK_TIMEOUT_MS)

  try {
    const response = await fetch(`${apiProxyTarget}${API_HEALTHCHECK_PATH}`, { signal: controller.signal })
    const payload = await response.json().catch(() => undefined)
    return {
      ok: response.status === 400 && payload?.error === API_HEALTHCHECK_EXPECTED_ERROR,
      status: response.status
    }
  } catch (error) {
    return {
      ok: false,
      error
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function inspectPortOwner(port) {
  const inspectionResult = Bun.spawnSync({
    cmd: ['bash', '-lc', `ss -ltnp '( sport = :${port} )' 2>/dev/null`],
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const inspectionText = inspectionResult.stdout.toString().trim()
  const match = inspectionText.match(/users:\(\("([^"]+)",pid=(\d+)/)

  if (!match) {
    return undefined
  }

  const pid = Number(match[2])
  return {
    pid,
    command: match[1],
    workspacePath: resolveRealPath(`/proc/${pid}/cwd`)
  }
}

function getListeningSocketSummary(port) {
  const inspectionResult = Bun.spawnSync({
    cmd: ['bash', '-lc', `ss -ltn '( sport = :${port} )' 2>/dev/null | tail -n +2`],
    stdout: 'pipe',
    stderr: 'pipe'
  })

  return inspectionResult.stdout.toString().trim()
}

function getApiChangeEntries(changePaths) {
  const gitStatus = Bun.spawnSync({
    cmd: ['git', 'status', '--short', '--untracked-files=all', '--', ...changePaths],
    stdout: 'pipe',
    stderr: 'pipe'
  })

  if (gitStatus.exitCode !== 0) {
    return []
  }

  return gitStatus.stdout
    .toString()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function isPortAvailable(port) {
  return getListeningSocketSummary(port) === ''
}

async function findNextAvailablePort(startPort) {
  return (await isPortAvailable(startPort)) ? startPort : findNextAvailablePort(startPort + 1)
}

export function resolveLauncherStrategy({
  defaultApiPort,
  portAvailable,
  healthyExistingApi,
  ownerWorkspaceMatches,
  hasApiChanges,
  nextAvailablePort
}) {
  if (portAvailable) {
    return {
      kind: 'start-new',
      apiPort: defaultApiPort,
      reuseExistingApi: false,
      shouldPrompt: false
    }
  }

  if (healthyExistingApi && ownerWorkspaceMatches && !hasApiChanges) {
    return {
      kind: 'reuse-existing',
      apiPort: defaultApiPort,
      reuseExistingApi: true,
      shouldPrompt: false
    }
  }

  return {
    kind: 'prompt',
    apiPort: nextAvailablePort,
    recommendedPort: nextAvailablePort,
    reuseExistingApi: false,
    canReuseExistingApi: healthyExistingApi,
    shouldPrompt: true
  }
}

async function promptForCustomPort(defaultPort) {
  const rl = createInterface({ input, output })
  const answer = (await rl.question(`Custom API port [${defaultPort}]: `)).trim()
  rl.close()

  const selectedPort = normalizePort(answer || String(defaultPort), 0)

  if (!selectedPort) {
    output.write('Enter a valid positive port number.\n')
    return promptForCustomPort(defaultPort)
  }

  if (!(await isPortAvailable(selectedPort))) {
    output.write(`Port ${selectedPort} is already in use.\n`)
    return promptForCustomPort(defaultPort)
  }

  return selectedPort
}

async function promptForApiRuntime({
  defaultApiPort,
  commandOwner,
  healthyExistingApi,
  apiChangeEntries,
  recommendedPort,
  canReuseExistingApi
}) {
  output.write(`\nDefault API port ${defaultApiPort} is already in use.\n`)
  output.write(`Owner: ${describeCommandOwner(commandOwner)}\n`)
  output.write(`Health: ${healthyExistingApi ? 'Yearn API server detected' : 'Not the expected Yearn API response'}\n`)

  if (apiChangeEntries.length > 0) {
    output.write(`API-related changes in this worktree:\n${apiChangeEntries.map((entry) => `  ${entry}`).join('\n')}\n`)
  }

  const options = [
    {
      key: '1',
      label: `Start this workspace on ${recommendedPort} (Recommended)`,
      value: { apiPort: recommendedPort, reuseExistingApi: false }
    },
    canReuseExistingApi
      ? {
          key: '2',
          label: `Reuse the existing API on ${defaultApiPort} and start only the client`,
          value: { apiPort: defaultApiPort, reuseExistingApi: true }
        }
      : undefined,
    {
      key: canReuseExistingApi ? '3' : '2',
      label: 'Choose a custom API port',
      value: 'custom'
    },
    {
      key: canReuseExistingApi ? '4' : '3',
      label: 'Cancel',
      value: 'cancel'
    }
  ].filter(Boolean)

  output.write(`${options.map((option) => `${option.key}. ${option.label}`).join('\n')}\n`)

  const rl = createInterface({ input, output })
  const answer = (await rl.question('Choice [1]: ')).trim() || '1'
  rl.close()

  const selectedOption = options.find((option) => option.key === answer)

  if (!selectedOption) {
    output.write('Invalid choice.\n')
    return promptForApiRuntime({
      defaultApiPort,
      commandOwner,
      healthyExistingApi,
      apiChangeEntries,
      recommendedPort,
      canReuseExistingApi
    })
  }

  if (selectedOption.value === 'cancel') {
    exit(1)
  }

  if (selectedOption.value === 'custom') {
    const customPort = await promptForCustomPort(recommendedPort)
    return { apiPort: customPort, reuseExistingApi: false }
  }

  return selectedOption.value
}

export function buildSessionEnv(apiPort, launcherEnv) {
  return {
    ...launcherEnv,
    API_PORT: String(apiPort),
    API_PROXY_TARGET: `http://localhost:${apiPort}`
  }
}

function killChild(child) {
  try {
    child.kill('SIGTERM')
  } catch {
    return undefined
  }

  return undefined
}

export async function runLauncherProcesses({ apiPort, reuseExistingApi, launcherEnv, serverCommand, clientCommand }) {
  const sessionEnv = buildSessionEnv(apiPort, launcherEnv)
  const children = [
    reuseExistingApi
      ? undefined
      : Bun.spawn(serverCommand, {
          env: sessionEnv,
          stdin: 'inherit',
          stdout: 'inherit',
          stderr: 'inherit'
        }),
    Bun.spawn(clientCommand, {
      env: sessionEnv,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit'
    })
  ].filter(Boolean)

  const stopChildren = () => children.map(killChild)
  const handleInterrupt = () => {
    stopChildren()
    exit(0)
  }

  process.once('SIGINT', handleInterrupt)
  process.once('SIGTERM', handleInterrupt)

  const firstExit = await Promise.race(children.map((child) => child.exited.then((code) => ({ child, code }))))
  children.filter((child) => child !== firstExit.child).map(killChild)

  exit(firstExit.code ?? 0)
}

export async function chooseApiRuntime({ changePaths = DEFAULT_API_CHANGE_PATHS } = {}) {
  const launcherEnv = resolveLauncherEnv()
  const { apiPort: defaultApiPort } = resolveConfiguredApiRuntime(launcherEnv)
  const currentWorkspacePath = resolveRealPath(cwd())
  const portAvailable = await isPortAvailable(defaultApiPort)
  const commandOwner = portAvailable ? undefined : inspectPortOwner(defaultApiPort)
  const healthyExistingApi = portAvailable ? false : (await checkApiHealth(`http://localhost:${defaultApiPort}`)).ok
  const apiChangeEntries = getApiChangeEntries(changePaths)
  const strategy = resolveLauncherStrategy({
    defaultApiPort,
    portAvailable,
    healthyExistingApi,
    ownerWorkspaceMatches: commandOwner?.workspacePath === currentWorkspacePath,
    hasApiChanges: apiChangeEntries.length > 0,
    nextAvailablePort: portAvailable ? defaultApiPort : await findNextAvailablePort(defaultApiPort + 1)
  })

  if (!strategy.shouldPrompt) {
    return {
      apiPort: strategy.apiPort,
      reuseExistingApi: strategy.reuseExistingApi,
      launcherEnv
    }
  }

  if (!input.isTTY || !output.isTTY) {
    output.write(
      `API port ${defaultApiPort} is busy${apiChangeEntries.length > 0 ? ' and this worktree has API-related changes' : ''}. Using ${strategy.recommendedPort} instead.\n`
    )

    return {
      apiPort: strategy.recommendedPort,
      reuseExistingApi: false,
      launcherEnv
    }
  }

  const selection = await promptForApiRuntime({
    defaultApiPort,
    commandOwner,
    healthyExistingApi,
    apiChangeEntries,
    recommendedPort: strategy.recommendedPort,
    canReuseExistingApi: strategy.canReuseExistingApi
  })

  return {
    ...selection,
    launcherEnv
  }
}
