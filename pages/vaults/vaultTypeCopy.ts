export type TVaultType = 'all' | 'factory' | 'v3'

export const VAULT_TYPE_COPY: Record<TVaultType, { label: string; emoji: string }> = {
  all: {
    label: 'All Vaults',
    emoji: '🌐'
  },
  v3: {
    label: 'Single Asset Vaults',
    emoji: '⚙️'
  },
  factory: {
    label: 'LP Vaults',
    emoji: '🏭'
  }
}

export function getVaultTypeLabel(vaultType: TVaultType): string {
  return VAULT_TYPE_COPY[vaultType].label
}

export function getVaultTypeEmoji(vaultType: TVaultType): string {
  return VAULT_TYPE_COPY[vaultType].emoji
}
