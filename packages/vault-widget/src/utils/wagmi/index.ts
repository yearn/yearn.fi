import type { Config } from 'wagmi'

export type VaultWidgetNetwork = {
  id: number
  defaultBlockExplorer: string
}

const BLOCK_EXPLORERS: Readonly<Record<number, string>> = {
  1: 'https://etherscan.io',
  10: 'https://optimistic.etherscan.io',
  137: 'https://polygonscan.com',
  250: 'https://ftmscan.com',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  146: 'https://sonicscan.org'
}

let registeredConfig: Config | undefined

export function registerConfig(config: Config): void {
  registeredConfig = config
}

export function retrieveConfig(): Config {
  if (!registeredConfig) {
    throw new Error('Vault widget Wagmi config has not been registered')
  }
  return registeredConfig
}

export function getNetwork(chainId: number): VaultWidgetNetwork {
  return {
    id: chainId,
    defaultBlockExplorer: BLOCK_EXPLORERS[chainId] ?? ''
  }
}
