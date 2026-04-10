import { exit, stdout as output } from 'node:process'
import {
  buildSessionEnv,
  chooseApiRuntime,
  DEFAULT_API_CHANGE_PATHS,
  resolveLauncherStrategy,
  runLauncherProcesses
} from './api-runtime.mjs'

const PREVIEW_API_CHANGE_PATHS = [...DEFAULT_API_CHANGE_PATHS, 'scripts/preview.mjs']

export const resolvePreviewLauncherStrategy = resolveLauncherStrategy

async function main() {
  const selection = await chooseApiRuntime({ changePaths: PREVIEW_API_CHANGE_PATHS, mode: 'production' })
  const sessionEnv = buildSessionEnv(selection)

  output.write(
    `${selection.reuseExistingApi ? 'Reusing' : 'Starting'} API ${selection.reuseExistingApi ? 'at' : 'on'} ${sessionEnv.API_PROXY_TARGET}\n`
  )

  await runLauncherProcesses({
    ...selection,
    serverCommand: ['bun', 'run', 'preview:server'],
    clientCommand: ['bun', 'run', 'preview:client']
  })
}

if (typeof Bun !== 'undefined' && import.meta.path === Bun.main) {
  void main().catch((error) => {
    console.error('Failed to start preview environment', error)
    exit(1)
  })
}
