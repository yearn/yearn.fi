import type { Config } from 'wagmi'

const registeredConfig: { current?: Config } = {}

export function retrieveConfig(): Config {
  if (!registeredConfig.current) {
    throw new Error('Config not set')
  }

  return registeredConfig.current
}

export function registerConfig(config: Config): void {
  registeredConfig.current = config
}
