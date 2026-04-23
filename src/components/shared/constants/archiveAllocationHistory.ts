export const SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS = [
  {
    chainId: 1,
    vaultAddress: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204' as const
  },
  {
    chainId: 1,
    vaultAddress: '0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0' as const
  }
] as const

const SUPPORTED_MAINNET_ARCHIVE_ALLOCATION_VAULTS = new Set(
  SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS.map((target) => target.vaultAddress.toLowerCase())
)

export function supportsArchiveAllocationHistory(chainId: number, vaultAddress?: string | null): boolean {
  if (chainId !== 1 || !vaultAddress) {
    return false
  }

  return SUPPORTED_MAINNET_ARCHIVE_ALLOCATION_VAULTS.has(vaultAddress.toLowerCase())
}
