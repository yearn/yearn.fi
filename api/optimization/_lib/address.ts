export const MAX_VAULT_STATE_STRATEGIES = 100

const ETHEREUM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

export function isValidEthereumAddress(address: string): boolean {
  return ETHEREUM_ADDRESS_REGEX.test(address)
}

type TStrategyAddressParseResult =
  | { error: 'Invalid strategy addresses' | 'No strategy addresses provided' | 'Too many strategy addresses' }
  | { strategies: string[] }

export function parseVaultStateStrategies(value: unknown): TStrategyAddressParseResult {
  if (!Array.isArray(value)) {
    return { error: 'No strategy addresses provided' }
  }

  if (value.length === 0) {
    return { error: 'No strategy addresses provided' }
  }

  if (value.length > MAX_VAULT_STATE_STRATEGIES) {
    return { error: 'Too many strategy addresses' }
  }

  if (
    !value.every((strategy): strategy is string => typeof strategy === 'string' && isValidEthereumAddress(strategy))
  ) {
    return { error: 'Invalid strategy addresses' }
  }

  return { strategies: value }
}
