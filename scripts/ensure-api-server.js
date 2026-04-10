const DEFAULT_API_PORT = '3001'
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET || `http://localhost:${process.env.API_PORT || process.env.API_SERVER_PORT || DEFAULT_API_PORT}`
const API_PROXY_TARGET_DESCRIPTION = process.env.API_PROXY_TARGET?.trim()
  ? 'the configured API proxy target'
  : 'the default local API address'

const API_HEALTHCHECK_PATH = process.env.API_HEALTHCHECK_PATH || '/api/enso/balances'
const API_HEALTHCHECK_EXPECTED_ERROR = 'Missing eoaAddress'
const API_HEALTHCHECK_TIMEOUT_MS = Number(process.env.API_HEALTHCHECK_TIMEOUT_MS || '500')

function resolveApiPort() {
  if (process.env.API_PORT) {
    return process.env.API_PORT
  }

  try {
    const parsedTarget = new URL(API_PROXY_TARGET)
    return parsedTarget.port || (parsedTarget.protocol === 'https:' ? '443' : '80')
  } catch {
    return '3001'
  }
}

async function checkApi() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_HEALTHCHECK_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_PROXY_TARGET}${API_HEALTHCHECK_PATH}`, { signal: controller.signal })
    const data = await response.json().catch(() => null)
    if (response.status === 400 && data?.error === API_HEALTHCHECK_EXPECTED_ERROR) {
      return { ok: true }
    }

    return { ok: false, reason: 'unexpected-response', status: response.status }
  } catch (error) {
    return { ok: false, reason: 'no-response', error }
  } finally {
    clearTimeout(timeout)
  }
}

;(async () => {
  const health = await checkApi()
  if (health.ok) {
    console.log(`API already running at ${API_PROXY_TARGET_DESCRIPTION}`)
    process.exit(0)
  }

  if (health.reason === 'unexpected-response') {
    console.error(
      `${API_PROXY_TARGET_DESCRIPTION} is already in use, but it doesn't look like the Yearn API server. Stop that process or set API_PROXY_TARGET to a different value.`
    )
    process.exit(1)
  }

  const child = Bun.spawn(['bun', 'api/server.ts'], {
    env: {
      ...process.env,
      API_PORT: resolveApiPort()
    },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })

  const exitCode = await child.exited
  process.exit(exitCode)
})().catch((error) => {
  console.error('Failed to start or detect API server', error)
  process.exit(1)
})
