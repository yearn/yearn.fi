const net = require('net')

const DEFAULT_CLIENT_PORT = 3000
const DEFAULT_API_PORT = 3001
const DEFAULT_HOST = '127.0.0.1'
const MAX_PORT_ATTEMPTS = 100

function isPositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0
}

function resolvePort(value, fallback) {
  return isPositiveInteger(value) ? Number(value) : fallback
}

function checkPortAvailability(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    server.listen(port, host)
  })
}

function requestEphemeralPort(host, reservedPorts = new Set()) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once('error', reject)

    server.once('listening', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : undefined

      if (!port) {
        server.close(() => reject(new Error('Failed to resolve an ephemeral port')))
        return
      }

      server.close(async () => {
        if (reservedPorts.has(port)) {
          try {
            const nextPort = await requestEphemeralPort(host, reservedPorts)
            resolve(nextPort)
          } catch (error) {
            reject(error)
          }
          return
        }

        resolve(port)
      })
    })

    server.listen(0, host)
  })
}

async function findAvailablePort(startPort, host, attemptsLeft = MAX_PORT_ATTEMPTS, reservedPorts = new Set()) {
  if (attemptsLeft <= 0) {
    throw new Error(`Unable to find an available port starting at ${startPort}`)
  }

  if (reservedPorts.has(startPort)) {
    return findAvailablePort(startPort + 1, host, attemptsLeft - 1, reservedPorts)
  }

  const isAvailable = await checkPortAvailability(startPort, host)
  if (isAvailable) {
    return startPort
  }

  return findAvailablePort(startPort + 1, host, attemptsLeft - 1, reservedPorts)
}

async function resolveOpenPort(startPort, host, reservedPorts = new Set()) {
  try {
    return await findAvailablePort(startPort, host, MAX_PORT_ATTEMPTS, reservedPorts)
  } catch (_error) {
    return requestEphemeralPort(host, reservedPorts)
  }
}

function createEnv({ apiPort, host }) {
  return {
    ...process.env,
    API_PROXY_HOST: host,
    API_PROXY_TARGET: `http://${host}:${apiPort}`,
    API_SERVER_PORT: String(apiPort)
  }
}

function spawnChild(command, env) {
  return Bun.spawn(command, {
    env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
}

function terminateChild(child) {
  if (child.exitCode !== null) {
    return
  }

  child.kill('SIGTERM')
}

async function waitForChildren(children) {
  const exitCode = await Promise.race(children.map((child) => child.exited))
  children.forEach(terminateChild)
  process.exit(exitCode)
}

async function resolveStartupConfig() {
  const host = process.env.HOST || process.env.API_PROXY_HOST || DEFAULT_HOST
  const explicitClientPort = process.env.PORT
  const explicitApiPort = process.env.API_SERVER_PORT

  const clientPort = explicitClientPort ? resolvePort(explicitClientPort, DEFAULT_CLIENT_PORT) : undefined
  const apiPort = explicitApiPort
    ? resolvePort(explicitApiPort, DEFAULT_API_PORT)
    : await resolveOpenPort(DEFAULT_API_PORT, host, clientPort ? new Set([clientPort]) : new Set())

  if (clientPort && apiPort === clientPort) {
    throw new Error(`Client and API ports must be different. Both resolved to ${clientPort}`)
  }

  return { apiPort, clientPort, host }
}

async function main() {
  const mode = process.argv[2]
  if (!mode || !['dev', 'preview'].includes(mode)) {
    throw new Error('Usage: bun scripts/run-local.js <dev|preview>')
  }

  const { apiPort, clientPort, host } = await resolveStartupConfig()
  const env = {
    ...createEnv({ apiPort, host }),
    HOST: host,
    ...(clientPort ? { PORT: String(clientPort) } : {})
  }

  console.log(`${mode} startup using API ${env.API_PROXY_TARGET}${clientPort ? ` and client http://${host}:${clientPort}` : ''}`)

  const apiCommand = mode === 'dev' ? ['bun', '--watch', 'api/server.ts'] : ['bun', 'api/server.ts']
  const clientPortArgs = clientPort ? ['--port', String(clientPort)] : []
  const clientCommand =
    mode === 'dev'
      ? ['bunx', 'vite', '--host', host, ...clientPortArgs]
      : ['bunx', 'vite', 'preview', '--host', host, ...clientPortArgs]

  const apiChild = spawnChild(apiCommand, env)
  const clientChild = spawnChild(clientCommand, env)

  ;['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
      ;[apiChild, clientChild].forEach(terminateChild)
    })
  })

  await waitForChildren([apiChild, clientChild])
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
