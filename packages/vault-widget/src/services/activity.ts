import { type Hash, isAddressEqual } from 'viem'
import type { Config } from 'wagmi'
import type { EnsoBridgeStatusProvider, VaultWidgetActivity, VaultWidgetConfig, VaultWidgetQuote } from '../types'
import type { VaultWidgetActivityStore, VaultWidgetExecutionService } from './types'

export async function addVaultWidgetActivitySafely(
  store: VaultWidgetActivityStore,
  activity: VaultWidgetActivity
): Promise<number | undefined> {
  try {
    return await store.add(activity)
  } catch {
    return undefined
  }
}

export async function updateVaultWidgetActivitySafely(
  store: VaultWidgetActivityStore,
  id: number | undefined,
  activity: Partial<VaultWidgetActivity>
): Promise<void> {
  if (id === undefined) return
  try {
    await store.update(id, activity)
  } catch {
    // Activity history is best-effort and must never block transaction execution.
  }
}

export function getVaultWidgetRelatedAddresses(config: VaultWidgetConfig): readonly `0x${string}`[] {
  const addresses = [
    config.vaultAddress,
    config.positionToken.address,
    ...(config.positionSources ?? []).map(({ token }) => token.address),
    ...(config.infoPositionSources ?? []).map(({ token }) => token.address),
    ...(config.info?.relatedAddresses ?? []),
    config.migration?.targetVault,
    config.rewards?.stakingAddress
  ].filter((address): address is `0x${string}` => !!address)

  return addresses.filter(
    (address, index) => addresses.findIndex((candidate) => isAddressEqual(candidate, address)) === index
  )
}

export function resolveVaultWidgetActivityDestinationChainId(params: {
  configChainId: number
  mode: 'deposit' | 'withdraw'
  quote: Pick<VaultWidgetQuote, 'bridge'>
  selectedTokenChainId: number
}): number {
  return (
    params.quote.bridge?.destinationChainId ??
    (params.mode === 'deposit' ? params.configChainId : params.selectedTokenChainId)
  )
}

export function filterVaultWidgetActivities(
  activities: readonly VaultWidgetActivity[],
  params: {
    account: `0x${string}`
    chainId: number
    relatedAddresses: readonly `0x${string}`[]
  }
): readonly VaultWidgetActivity[] {
  return activities
    .filter((activity) => {
      if (!isAddressEqual(activity.account, params.account)) return false
      if (activity.chainId !== params.chainId && activity.destinationChainId !== params.chainId) return false
      return params.relatedAddresses.some(
        (address) =>
          (!!activity.tokenIn && isAddressEqual(activity.tokenIn, address)) ||
          (!!activity.tokenOut && isAddressEqual(activity.tokenOut, address))
      )
    })
    .toSorted((left, right) => right.timestamp - left.timestamp)
}

export type VaultWidgetActivityReconciliation = Pick<
  VaultWidgetActivity,
  'destinationHash' | 'hash' | 'status' | 'timestamp'
>

export async function reconcileVaultWidgetActivity(params: {
  activity: VaultWidgetActivity
  config: Config
  ensoBridge?: EnsoBridgeStatusProvider
  execution: VaultWidgetExecutionService
}): Promise<VaultWidgetActivityReconciliation | undefined> {
  const { activity } = params
  if ((activity.status !== 'pending' && activity.status !== 'submitted') || activity.isFinalTransaction !== true) {
    return undefined
  }

  let hash: Hash | undefined = activity.hash
  try {
    if (activity.proposalId && params.execution.waitForSafeExecution) {
      hash = await params.execution.waitForSafeExecution(params.config, activity.chainId, activity.proposalId)
      if (!hash) throw new Error('Safe execution completed without a transaction receipt')
    }
    if (!hash) return undefined

    if (activity.bridge && params.ensoBridge) {
      const bridgeStatus = await params.ensoBridge.waitForCompletion({
        ...activity.bridge,
        sourceTxHash: hash
      })
      return {
        destinationHash: bridgeStatus.destinationTxHash,
        hash,
        status: 'success',
        timestamp: Date.now()
      }
    }

    await params.execution.waitForReceipt(params.config, activity.chainId, hash)
    return {
      hash,
      status: 'success',
      timestamp: Date.now()
    }
  } catch {
    return {
      hash,
      status: 'error',
      timestamp: Date.now()
    }
  }
}
