import type { Config, ResolvedRegister } from 'wagmi'

let CONFIG: Config | undefined

export function retrieveConfig(): ResolvedRegister['config'] {
  if (!CONFIG) {
    throw new Error('Config not set')
  }
  return CONFIG as ResolvedRegister['config']
}

export function registerConfig(config: Config): void {
  CONFIG = config
}
