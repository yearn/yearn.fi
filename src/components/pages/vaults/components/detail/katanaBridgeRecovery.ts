import {
  KATANA_NATIVE_BRIDGE_ETHEREUM_NETWORK_ID,
  KATANA_VAULT_BRIDGE_DESTINATION_NETWORK_ID,
  type KatanaBridgeAssetConfig
} from '@pages/vaults/components/widget/katanaBridge'
import { toAddress } from '@shared/utils'
import type { TKatanaBridgeDirection, TKatanaBridgeTransaction } from '@shared/utils/katanaBridge'

export function getKatanaBridgeTransactionDirection(
  transaction: TKatanaBridgeTransaction
): TKatanaBridgeDirection | undefined {
  if (
    transaction.fromChainId === KATANA_VAULT_BRIDGE_DESTINATION_NETWORK_ID ||
    transaction.toChainId === KATANA_NATIVE_BRIDGE_ETHEREUM_NETWORK_ID
  ) {
    return 'to-ethereum'
  }

  if (
    transaction.toChainId === KATANA_VAULT_BRIDGE_DESTINATION_NETWORK_ID ||
    transaction.fromChainId === KATANA_NATIVE_BRIDGE_ETHEREUM_NETWORK_ID
  ) {
    return 'to-katana'
  }

  return undefined
}

function matchesTransactionAsset({
  transaction,
  assetConfig
}: {
  transaction: TKatanaBridgeTransaction
  assetConfig: KatanaBridgeAssetConfig
}): boolean {
  if (!transaction.tokenAddress && !transaction.tokenSymbol) {
    return true
  }

  const knownAddresses = new Set(
    [
      assetConfig.sourceTokenAddress,
      assetConfig.destinationTokenAddress,
      assetConfig.ethereumVaultBridgeAddress,
      assetConfig.katanaAssetAddress
    ].map((address) => toAddress(address).toLowerCase())
  )
  const knownSymbols = new Set(
    [assetConfig.sourceTokenSymbol, assetConfig.destinationTokenSymbol, assetConfig.katanaAssetSymbol]
      .filter(Boolean)
      .map((symbol) => symbol.toLowerCase())
  )

  if (transaction.tokenAddress && knownAddresses.has(toAddress(transaction.tokenAddress).toLowerCase())) {
    return true
  }

  if (transaction.tokenSymbol && knownSymbols.has(transaction.tokenSymbol.toLowerCase())) {
    return true
  }

  return false
}

function getRecoveryPriority(transaction: TKatanaBridgeTransaction): number {
  switch (transaction.status) {
    case 'READY_TO_CLAIM':
      return 3
    case 'BRIDGE_PENDING':
      return 2
    case 'SOURCE_CONFIRMED':
      return 1
    default:
      return 0
  }
}

export function pickKatanaBridgeRecoveryTransaction({
  transactions,
  assetConfig
}: {
  transactions: TKatanaBridgeTransaction[]
  assetConfig: KatanaBridgeAssetConfig
}): TKatanaBridgeTransaction | undefined {
  return [...transactions]
    .filter((transaction) => {
      const direction = getKatanaBridgeTransactionDirection(transaction)
      if (!direction) {
        return false
      }

      if (transaction.status === 'COMPLETED' || transaction.status === 'FAILED') {
        return false
      }

      return matchesTransactionAsset({ transaction, assetConfig })
    })
    .sort((firstTransaction, secondTransaction) => {
      const priorityDifference = getRecoveryPriority(secondTransaction) - getRecoveryPriority(firstTransaction)
      if (priorityDifference !== 0) {
        return priorityDifference
      }

      return (secondTransaction.timestamp || 0) - (firstTransaction.timestamp || 0)
    })[0]
}
