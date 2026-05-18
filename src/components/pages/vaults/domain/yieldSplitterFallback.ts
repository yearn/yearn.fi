import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { TKongVaultListItem, TKongVaultListItemYieldSplitter } from '@shared/utils/schemas/kongVaultListSchema'
import { zeroAddress } from 'viem'

type TYieldSplitterFallbackRoute = {
  chainId: number
  sourceVaultAddress: `0x${string}`
  splitterAddress: `0x${string}`
  wantVaultAddress: `0x${string}`
}

const YIELD_SPLITTER_FALLBACK_ROUTES: TYieldSplitterFallbackRoute[] = [
  {
    chainId: KATANA_CHAIN_ID,
    sourceVaultAddress: '0xE007CA01894c863d7898045ed5A3B4Abf0b18f37',
    splitterAddress: '0xA03e39CDeAC8c2823A6EDC80956207294807c20d',
    wantVaultAddress: '0x80c34BD3A3569E126e7055831036aa7b212cB159'
  },
  {
    chainId: KATANA_CHAIN_ID,
    sourceVaultAddress: '0xAa0362eCC584B985056E47812931270b99C91f9d',
    splitterAddress: '0x2f817617A682A18851E3EaCBD945b214BE70474E',
    wantVaultAddress: '0x80c34BD3A3569E126e7055831036aa7b212cB159'
  },
  {
    chainId: KATANA_CHAIN_ID,
    sourceVaultAddress: '0x80c34BD3A3569E126e7055831036aa7b212cB159',
    splitterAddress: '0xF352cdbE225B82Cc458aCa3c127F2935d7EE12CB',
    wantVaultAddress: '0xE007CA01894c863d7898045ed5A3B4Abf0b18f37'
  },
  {
    chainId: KATANA_CHAIN_ID,
    sourceVaultAddress: '0x80c34BD3A3569E126e7055831036aa7b212cB159',
    splitterAddress: '0x1166da048a9B0E840A57dD9Dce5378e6c32E53C4',
    wantVaultAddress: '0xAa0362eCC584B985056E47812931270b99C91f9d'
  },
  {
    chainId: KATANA_CHAIN_ID,
    sourceVaultAddress: '0xE007CA01894c863d7898045ed5A3B4Abf0b18f37',
    splitterAddress: '0x17E6ee30d939d1C0186EF98265e9a4E38A056AA1',
    wantVaultAddress: '0xAa0362eCC584B985056E47812931270b99C91f9d'
  },
  {
    chainId: KATANA_CHAIN_ID,
    sourceVaultAddress: '0xAa0362eCC584B985056E47812931270b99C91f9d',
    splitterAddress: '0x518EA05c41F89e36985A94c6dF8782F6d3F45111',
    wantVaultAddress: '0xE007CA01894c863d7898045ed5A3B4Abf0b18f37'
  }
]

const WANT_DISPLAY_META: Record<string, string> = {
  [toAddress('0x80c34BD3A3569E126e7055831036aa7b212cB159')]: 'USD',
  [toAddress('0xE007CA01894c863d7898045ed5A3B4Abf0b18f37')]: 'ETH',
  [toAddress('0xAa0362eCC584B985056E47812931270b99C91f9d')]: 'BTC'
}

function getFallbackRouteBySplitterAddress(
  splitterAddress: string | undefined,
  chainId?: number
): TYieldSplitterFallbackRoute | undefined {
  if (!splitterAddress) {
    return undefined
  }

  const normalizedAddress = toAddress(splitterAddress)
  return YIELD_SPLITTER_FALLBACK_ROUTES.find(
    (route) =>
      toAddress(route.splitterAddress) === normalizedAddress && (chainId === undefined || route.chainId === chainId)
  )
}

export function getYieldSplitterFallbackSourceVaultAddress(
  splitterAddress: string | undefined,
  chainId?: number
): `0x${string}` | undefined {
  return getFallbackRouteBySplitterAddress(splitterAddress, chainId)?.sourceVaultAddress
}

export function getYieldSplitterFallback(
  vault: TKongVaultListItem,
  vaults: TDict<TKongVaultListItem>
): TKongVaultListItemYieldSplitter | undefined {
  if (vault.yieldSplitter?.enabled) {
    return vault.yieldSplitter
  }

  const route = getFallbackRouteBySplitterAddress(vault.address, vault.chainId)
  if (!route) {
    return undefined
  }

  const sourceVault = vaults[toAddress(route.sourceVaultAddress)]
  const wantVault = vaults[toAddress(route.wantVaultAddress)]
  const depositAsset = sourceVault?.asset ?? vault.asset
  const wantDisplayLabel =
    WANT_DISPLAY_META[toAddress(route.wantVaultAddress)] || wantVault?.symbol || wantVault?.name || 'the target vault'

  return {
    enabled: true,
    sourceVaultAddress: toAddress(route.sourceVaultAddress),
    sourceVaultName: sourceVault?.name ?? '',
    sourceVaultSymbol: sourceVault?.symbol ?? '',
    wantVaultAddress: toAddress(route.wantVaultAddress),
    wantVaultName: wantVault?.name ?? '',
    wantVaultSymbol: wantDisplayLabel,
    depositAssetAddress: depositAsset?.address ?? zeroAddress,
    depositAssetName: depositAsset?.name ?? '',
    depositAssetSymbol: depositAsset?.symbol ?? '',
    rewardTokenAddresses: [],
    rewardHandlerAddress: zeroAddress,
    tokenizedStrategyAddress: zeroAddress,
    displayType: 'Yield Splitter',
    displayKind: 'Vault-to-Vault',
    uiDescription:
      sourceVault?.name && wantDisplayLabel
        ? `Deposit into ${sourceVault.name} and route yield into ${wantDisplayLabel}.`
        : ''
  }
}

export function applyYieldSplitterFallbacks(vaults: TDict<TKongVaultListItem>): TDict<TKongVaultListItem> {
  return Object.entries(vaults).reduce<TDict<TKongVaultListItem>>((accumulator, [address, vault]) => {
    const yieldSplitter = getYieldSplitterFallback(vault, vaults)
    accumulator[address] = yieldSplitter ? { ...vault, yieldSplitter } : vault
    return accumulator
  }, {})
}
