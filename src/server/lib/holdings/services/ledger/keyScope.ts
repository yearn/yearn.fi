import { LEDGER_SCHEMA_VERSION } from '@/server/lib/holdings/services/ledger/types'

const LEDGER_WALLET_KEY_PATTERN = new RegExp(`^holdings:ledger:v${LEDGER_SCHEMA_VERSION}:\\{([a-f0-9]{64})\\}:(.+)$`)
const LEDGER_KEY_NAMESPACE_PATTERN = /^namespace:([A-Za-z0-9_-]{1,64}):(.+)$/

function getLedgerKeyScope(key: string): { readonly walletHash: string; readonly namespace: string | null } {
  const match = LEDGER_WALLET_KEY_PATTERN.exec(key)
  const walletHash = match?.[1]
  const suffix = match?.[2]
  if (!walletHash || !suffix) {
    throw new Error('Ledger Redis keys must use the versioned hashed-wallet namespace')
  }
  if (!suffix.startsWith('namespace:')) {
    return { walletHash, namespace: null }
  }
  const namespacedSuffix = LEDGER_KEY_NAMESPACE_PATTERN.exec(suffix)
  if (!namespacedSuffix) {
    throw new Error('Ledger Redis keys must use the versioned hashed-wallet namespace')
  }
  return { walletHash, namespace: namespacedSuffix[1] as string }
}

export function assertLedgerKeysShareWalletScope(keys: readonly string[]): string {
  if (keys.length === 0) {
    throw new Error('Ledger key scope requires at least one key')
  }

  const scopes = keys.map(getLedgerKeyScope)
  const scope = scopes[0] as (typeof scopes)[number]

  if (
    scopes.some((candidate) => candidate.walletHash !== scope.walletHash || candidate.namespace !== scope.namespace)
  ) {
    throw new Error('Ledger Redis keys must belong to the same hashed wallet')
  }

  return scope.walletHash
}
