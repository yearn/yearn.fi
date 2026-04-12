import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'

export const TOKEN_SELECTOR_AVAILABLE_CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 10, name: 'Optimism' },
  { id: 137, name: 'Polygon' },
  { id: 42161, name: 'Arbitrum' },
  { id: 8453, name: 'Base' },
  { id: KATANA_CHAIN_ID, name: 'Katana' }
] as const

const NON_KATANA_SELECTOR_CHAIN_IDS = TOKEN_SELECTOR_AVAILABLE_CHAINS.map((chain) => chain.id).filter(
  (chainId) => chainId !== KATANA_CHAIN_ID
)

export function getAllowedTokenSelectorChainIds(vaultChainId: number): number[] {
  if (vaultChainId === KATANA_CHAIN_ID) {
    return [KATANA_CHAIN_ID]
  }

  return [...NON_KATANA_SELECTOR_CHAIN_IDS]
}
