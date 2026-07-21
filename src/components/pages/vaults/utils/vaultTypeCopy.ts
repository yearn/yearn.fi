export type TVaultType = 'all' | 'factory' | 'fixed' | 'v3'

export const VAULT_TYPE_COPY: Record<TVaultType, { label: string; emoji: string }> = {
  all: {
    label: 'All Vaults',
    emoji: '🌐'
  },
  v3: {
    label: 'Floating Yield',
    emoji: '⚙️'
  },
  fixed: {
    label: 'Fixed Yield',
    emoji: '🛡️'
  },
  factory: {
    label: 'LP Token',
    emoji: '🏭'
  }
}

export const VAULT_TYPE_DESCRIPTION: Record<TVaultType, string | null> = {
  all: null,
  v3: 'Floating-rate vaults whose yield changes with strategy performance.',
  fixed: 'Senior tranche products designed for predictable, reserve-backed yield.',
  factory: 'Deposits a DEX LP token; yield comes from fees and incentives, auto-compounded.'
}

export function getVaultTypeLabel(vaultType: TVaultType): string {
  return VAULT_TYPE_COPY[vaultType].label
}

export function getVaultTypeEmoji(vaultType: TVaultType): string {
  return VAULT_TYPE_COPY[vaultType].emoji
}

export function getVaultTypeDescription(vaultType: TVaultType): string | null {
  return VAULT_TYPE_DESCRIPTION[vaultType]
}
