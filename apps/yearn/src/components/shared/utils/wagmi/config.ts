import type { Config } from 'wagmi'

const registry: { config?: Config } = {}

export function retrieveConfig(): Config {
  if (!registry.config) throw new Error('Config not set')
  return registry.config
}

export function registerConfig(config: Config): void {
  registry.config = config
}
