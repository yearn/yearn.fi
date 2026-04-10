import { exit, stdout as output } from 'node:process'
import {
  buildSessionEnv,
  chooseApiRuntime,
  DEFAULT_API_CHANGE_PATHS,
  resolveLauncherStrategy,
  runLauncherProcesses
} from './api-runtime.mjs'

const DEV_API_CHANGE_PATHS = [...DEFAULT_API_CHANGE_PATHS, 'scripts/dev.mjs']

export const resolveDevLauncherStrategy = resolveLauncherStrategy

async function main() {
  const selection = await chooseApiRuntime({ changePaths: DEV_API_CHANGE_PATHS })
  const sessionEnv = buildSessionEnv(selection)

  output.write(
    `${selection.reuseExistingApi ? 'Reusing' : 'Starting'} API ${selection.reuseExistingApi ? 'at' : 'on'} ${sessionEnv.API_PROXY_TARGET}\n`
  )

  await runLauncherProcesses({
    ...selection,
    serverCommand: ['bun', 'run', 'dev:server'],
    clientCommand: ['bun', 'run', 'dev:client']
  })
}

if (typeof Bun !== 'undefined' && import.meta.path === Bun.main) {
  void main().catch((error) => {
    console.error('Failed to start dev environment', error)
    exit(1)
  })
}
