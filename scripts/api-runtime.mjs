import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cwd, env, exit, stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { loadEnv } from 'vite'

const DEFAULT_API_PORT = 3001
const API_HEALTHCHECK_PATH = '/api/enso/balances'
const API_HEALTHCHECK_EXPECTED_ERROR = 'Missing eoaAddress'
const API_HEALTHCHECK_TIMEOUT_MS = 500
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])
const API_RUNTIME_STATE_DIR = join(tmpdir(), 'yearn-api-runtime')
export const DEFAULT_API_ENV_CHANGE_PATHS = ['.env', '.env.local']

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

function readWorkspacePathForPid(pid) {
  const procCwdPath = `/proc/${pid}/cwd`
  if (existsSync(procCwdPath)) {
    return resolveRealPath(procCwdPath)
  }

  return runCommand('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
    ?.stdout.split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('n'))
    ?.slice(1)
}

export function resolveLauncherEnv(
  mode,
  {
    envDir = cwd(),
    shellEnv = Object.fromEntries(Object.entries(env).filter((entry) => typeof entry[1] === 'string'))
  } = {}
) {
  return {
    ...loadEnv(mode, envDir, ''),
    ...shellEnv
  }
}

function getModeEnvChangePaths(mode) {
  return Array.from(new Set([...DEFAULT_API_ENV_CHANGE_PATHS, `.env.${mode}`, `.env.${mode}.local`]))
}

export function getApiChangePathsForMode(mode) {
  return [...DEFAULT_API_CHANGE_PATHS, ...getModeEnvChangePaths(mode)]
}

function resolveApiRuntimeStatePath(workspacePath, port) {
  const workspaceKey = createHash('sha1').update(workspacePath).digest('hex')
  return join(API_RUNTIME_STATE_DIR, `${workspaceKey}-${port}.json`)
}

function readApiRuntimeState(workspacePath, port) {
  const statePath = resolveApiRuntimeStatePath(workspacePath, port)

  if (!existsSync(statePath)) {
    return undefined
  }

  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return undefined
  }
}

function writeApiRuntimeState({ workspacePath, port, pid, mode, head, startedAtMs }) {
  mkdirSync(API_RUNTIME_STATE_DIR, { recursive: true })
  writeFileSync(
    resolveApiRuntimeStatePath(workspacePath, port),
    JSON.stringify({ pid, mode, head, startedAtMs }),
    'utf8'
  )
}

function getCurrentGitHead() {
  const gitHeadResult = runCommand('git', ['rev-parse', 'HEAD'])

  if (!gitHeadResult || gitHeadResult.status !== 0) {
    return undefined
  }

  const gitHead = gitHeadResult.stdout.trim()
  return gitHead || undefined
}

function readProcessStartedAtMs(pid) {
  const startedAtResult = runCommand('ps', ['-p', String(pid), '-o', 'lstart='])

  if (!startedAtResult || startedAtResult.status !== 0) {
    return undefined
  }

  const startedAtParts = startedAtResult.stdout.trim().split(/\s+/)
  if (startedAtParts.length < 5) {
    return undefined
  }

  const [, month, day, time, year] = startedAtParts
  const startedAtMs = Date.parse(`${month} ${day} ${year} ${time}`)

  return Number.isNaN(startedAtMs) ? undefined : startedAtMs
}

export function getEnvChangeEntriesSince(mode, startedAtMs, envDir = cwd()) {
  const envPaths = getModeEnvChangePaths(mode)

  return envPaths
    .map((relativePath) => ({
      relativePath,
      absolutePath: join(envDir, relativePath)
    }))
    .filter(({ absolutePath }) => existsSync(absolutePath))
    .flatMap(({ relativePath, absolutePath }) => {
      if (startedAtMs === undefined) {
        return [`M ${relativePath} (could not verify against the running API process start time)`]
      }

      return statSync(absolutePath).mtimeMs > startedAtMs
        ? [`M ${relativePath} (newer than the running API process)`]
        : []
    })
}

export function getRecordedApiRuntimeMismatchEntries({ workspacePath, port, pid, mode, processStartedAtMs }) {
  const recordedRuntimeState = readApiRuntimeState(workspacePath, port)

  if (!recordedRuntimeState) {
    return ['M could not verify the running API launch context for this workspace']
  }

  if (recordedRuntimeState.pid !== pid) {
    return ['M the running API pid does not match the last launcher-managed API process for this workspace']
  }

  if (processStartedAtMs === undefined || recordedRuntimeState.startedAtMs !== processStartedAtMs) {
    return ['M could not verify that the running API process matches the last launcher-managed start']
  }

  if (recordedRuntimeState.mode !== mode) {
    return [`M the running API was started in ${recordedRuntimeState.mode} mode, not ${mode}`]
  }

  return []
}

export function getRecordedApiCommittedChangeEntries({
  workspacePath,
  port,
  currentHead,
  changePaths,
  runCommandImpl = runCommand
}) {
  const recordedRuntimeState = readApiRuntimeState(workspacePath, port)

  if (!recordedRuntimeState?.head || !currentHead) {
    return ['M could not verify API-related commits since the running API started']
  }

  if (recordedRuntimeState.head === currentHead) {
    return []
  }

  const diffResult = runCommandImpl('git', [
    'diff',
    '--name-status',
    `${recordedRuntimeState.head}..${currentHead}`,
    '--',
    ...changePaths
  ])

  if (!diffResult || diffResult.status !== 0) {
    return ['M could not verify API-related commits since the running API started']
  }

  return diffResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export async function resolveLocalApiRuntimeOwner({
  apiPort,
  apiProxyTarget,
  checkApiHealthImpl = checkApiHealth,
  inspectPortOwnerImpl = inspectPortOwner,
  readProcessStartedAtMsImpl = readProcessStartedAtMs,
  timeoutMs = 5_000,
  pollIntervalMs = 100
}) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() <= deadline) {
    const health = await checkApiHealthImpl(apiProxyTarget)

    if (health.ok) {
      const portOwner = inspectPortOwnerImpl(apiPort)
      if (portOwner?.pid) {
        return {
          pid: portOwner.pid,
          startedAtMs: readProcessStartedAtMsImpl(portOwner.pid)
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  return undefined
}

function normalizePort(portValue, fallbackPort = DEFAULT_API_PORT) {
  const port = Number(portValue)
  return Number.isInteger(port) && port > 0 ? port : fallbackPort
}

function isLoopbackHostname(hostname) {
  return LOOPBACK_HOSTNAMES.has(hostname.trim().toLowerCase())
}

function getLocalApiProxyTarget(apiPort, apiProxyTarget) {
  try {
    const parsedTarget = new URL(apiProxyTarget)
    if (parsedTarget.protocol !== 'http:' || !isLoopbackHostname(parsedTarget.hostname)) {
      return `http://localhost:${apiPort}`
    }

    parsedTarget.port = String(apiPort)
    return parsedTarget.toString().replace(/\/$/, '')
  } catch {
    return `http://localhost:${apiPort}`
  }
}

export function resolveConfiguredApiRuntime(launcherEnv) {
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
        apiProxyTarget: explicitTarget.replace(/\/$/, ''),
        isLocalApiTarget: parsedTarget.protocol === 'http:' && isLoopbackHostname(parsedTarget.hostname)
      }
    } catch {
      return {
        apiPort: DEFAULT_API_PORT,
        apiProxyTarget: `http://localhost:${DEFAULT_API_PORT}`,
        isLocalApiTarget: true
      }
    }
  }

  const configuredPort = normalizePort(
    launcherEnv.API_PORT?.trim() || launcherEnv.VITE_API_PORT?.trim(),
    DEFAULT_API_PORT
  )

  return {
    apiPort: configuredPort,
    apiProxyTarget: `http://localhost:${configuredPort}`,
    isLocalApiTarget: true
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

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  if (result.error) {
    return undefined
  }

  return result
}

function inspectPortOwnerWithLsof(port) {
  const inspectionResult = runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpct'])

  if (!inspectionResult || inspectionResult.status !== 0) {
    return undefined
  }

  const lines = inspectionResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const pid = Number(lines.find((line) => line.startsWith('p'))?.slice(1))
  const command = lines.find((line) => line.startsWith('c'))?.slice(1)

  if (!pid || !command) {
    return undefined
  }

  return {
    pid,
    command,
    workspacePath: readWorkspacePathForPid(pid)
  }
}

function inspectPortOwnerWithSs(port) {
  const inspectionResult = runCommand('bash', ['-lc', `ss -ltnp '( sport = :${port} )' 2>/dev/null`])

  if (!inspectionResult || inspectionResult.status !== 0) {
    return undefined
  }

  const inspectionText = inspectionResult.stdout.trim()
  const match = inspectionText.match(/users:\(\("([^"]+)",pid=(\d+)/)

  if (!match) {
    return undefined
  }

  const pid = Number(match[2])
  return {
    pid,
    command: match[1],
    workspacePath: readWorkspacePathForPid(pid)
  }
}

function inspectPortOwner(port) {
  return inspectPortOwnerWithLsof(port) || inspectPortOwnerWithSs(port)
}

function getApiChangeEntries(changePaths) {
  const gitStatus = runCommand('git', ['status', '--short', '--untracked-files=all', '--', ...changePaths])

  if (!gitStatus || gitStatus.status !== 0) {
    return []
  }

  return gitStatus.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const probe = createServer()

    probe.once('error', (error) => {
      if (error && typeof error === 'object' && 'code' in error) {
        resolve(!['EADDRINUSE', 'EACCES'].includes(error.code))
        return
      }

      resolve(false)
    })

    probe.once('listening', () => {
      probe.close(() => resolve(true))
    })

    probe.listen({ port, exclusive: true })
  })
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

export function buildSessionEnv({ apiPort, apiProxyTarget, isLocalApiTarget, launcherEnv }) {
  const sessionEnv = {
    ...launcherEnv,
    API_PROXY_TARGET: apiProxyTarget
  }

  if (isLocalApiTarget) {
    sessionEnv.API_PORT = String(apiPort)
  } else {
    delete sessionEnv.API_PORT
  }

  return sessionEnv
}

function killChild(child) {
  try {
    child.kill('SIGTERM')
  } catch {
    return undefined
  }

  return undefined
}

export async function runLauncherProcesses({
  apiPort,
  apiProxyTarget,
  isLocalApiTarget,
  reuseExistingApi,
  launcherEnv,
  runtimeMetadata,
  serverCommand,
  clientCommand
}) {
  const sessionEnv = buildSessionEnv({
    apiPort,
    apiProxyTarget,
    isLocalApiTarget,
    launcherEnv
  })
  const children = [
    reuseExistingApi
      ? undefined
      : (() => {
          const serverChild = Bun.spawn(serverCommand, {
            env: sessionEnv,
            stdin: 'inherit',
            stdout: 'inherit',
            stderr: 'inherit'
          })

          if (runtimeMetadata) {
            void resolveLocalApiRuntimeOwner({ apiPort, apiProxyTarget }).then((runtimeOwner) => {
              if (!runtimeOwner) {
                return
              }

              writeApiRuntimeState({
                workspacePath: runtimeMetadata.workspacePath,
                port: apiPort,
                pid: runtimeOwner.pid,
                mode: runtimeMetadata.mode,
                head: runtimeMetadata.head,
                startedAtMs: runtimeOwner.startedAtMs
              })
            })
          }

          return serverChild
        })(),
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

export async function chooseApiRuntime({ changePaths, mode = 'development' } = {}) {
  const launcherEnv = resolveLauncherEnv(mode)
  const configuredApiRuntime = resolveConfiguredApiRuntime(launcherEnv)
  const { apiPort: defaultApiPort, apiProxyTarget, isLocalApiTarget } = configuredApiRuntime
  const currentHead = getCurrentGitHead()
  const trackedChangePaths = changePaths || getApiChangePathsForMode(mode)

  if (!isLocalApiTarget) {
    return {
      apiPort: defaultApiPort,
      apiProxyTarget,
      isLocalApiTarget,
      reuseExistingApi: true,
      launcherEnv
    }
  }

  const currentWorkspacePath = resolveRealPath(cwd())
  const portAvailable = await isPortAvailable(defaultApiPort)
  const commandOwner = portAvailable ? undefined : inspectPortOwner(defaultApiPort)
  const processStartedAtMs = commandOwner ? readProcessStartedAtMs(commandOwner.pid) : undefined
  const ownerWorkspaceMatches = commandOwner?.workspacePath === currentWorkspacePath
  const healthyExistingApi = portAvailable ? false : (await checkApiHealth(apiProxyTarget)).ok
  const trackedApiChangeEntries = getApiChangeEntries(trackedChangePaths)
  const runtimeEnvChangeEntries = ownerWorkspaceMatches ? getEnvChangeEntriesSince(mode, processStartedAtMs) : []
  const runtimeMismatchEntries =
    ownerWorkspaceMatches && healthyExistingApi
      ? getRecordedApiRuntimeMismatchEntries({
          workspacePath: currentWorkspacePath,
          port: defaultApiPort,
          pid: commandOwner.pid,
          mode,
          processStartedAtMs
        })
      : []
  const committedApiChangeEntries =
    ownerWorkspaceMatches && healthyExistingApi && runtimeMismatchEntries.length === 0
      ? getRecordedApiCommittedChangeEntries({
          workspacePath: currentWorkspacePath,
          port: defaultApiPort,
          currentHead,
          changePaths: trackedChangePaths
        })
      : []
  const apiChangeEntries = Array.from(
    new Set([
      ...trackedApiChangeEntries,
      ...runtimeEnvChangeEntries,
      ...runtimeMismatchEntries,
      ...committedApiChangeEntries
    ])
  )
  const strategy = resolveLauncherStrategy({
    defaultApiPort,
    portAvailable,
    healthyExistingApi,
    ownerWorkspaceMatches,
    hasApiChanges: apiChangeEntries.length > 0,
    nextAvailablePort: portAvailable ? defaultApiPort : await findNextAvailablePort(defaultApiPort + 1)
  })

  if (!strategy.shouldPrompt) {
    return {
      apiPort: strategy.apiPort,
      apiProxyTarget: strategy.reuseExistingApi
        ? apiProxyTarget
        : getLocalApiProxyTarget(strategy.apiPort, apiProxyTarget),
      isLocalApiTarget,
      reuseExistingApi: strategy.reuseExistingApi,
      launcherEnv,
      runtimeMetadata: strategy.reuseExistingApi
        ? undefined
        : {
            workspacePath: currentWorkspacePath,
            mode,
            head: currentHead
          }
    }
  }

  if (!input.isTTY || !output.isTTY) {
    output.write(
      `API port ${defaultApiPort} is busy${apiChangeEntries.length > 0 ? ' and this worktree has API-related changes' : ''}. Using ${strategy.recommendedPort} instead.\n`
    )

    return {
      apiPort: strategy.recommendedPort,
      apiProxyTarget: getLocalApiProxyTarget(strategy.recommendedPort, apiProxyTarget),
      isLocalApiTarget,
      reuseExistingApi: false,
      launcherEnv,
      runtimeMetadata: {
        workspacePath: currentWorkspacePath,
        mode,
        head: currentHead
      }
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
    apiProxyTarget: selection.reuseExistingApi
      ? apiProxyTarget
      : getLocalApiProxyTarget(selection.apiPort, apiProxyTarget),
    isLocalApiTarget,
    launcherEnv,
    runtimeMetadata: selection.reuseExistingApi
      ? undefined
      : {
          workspacePath: currentWorkspacePath,
          mode,
          head: currentHead
        }
  }
}
