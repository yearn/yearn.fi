export type TVaultType = 'all' | 'factory' | 'v3'

export const VAULT_TYPE_COPY: Record<TVaultType, { label: string; emoji: string }> = {
  all: {
    label: 'All Vaults',
    emoji: '🌐'
  },
  v3: {
    label: 'Single Asset',
    emoji: '⚙️'
  },
  factory: {
    label: 'LP Token',
    emoji: '🏭'
  }
}

export const VAULT_TYPE_DESCRIPTION: Record<TVaultType, string | null> = {
  all: null,
  v3: 'Deposits a single token; Yearn allocates it across strategies.',
  factory: 'Deposits a DEX LP token; yield comes from fees and incentives, auto-compounded.'
}

export function getVaultTypeLabel(vaultType: TVaultType): string {
  return VAULT_TYPE_COPY[vaultType].label
}

export function getVaultTypeDescription(vaultType: TVaultType): string | null {
  return VAULT_TYPE_DESCRIPTION[vaultType]
}
