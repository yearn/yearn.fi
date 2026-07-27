import { erc20Abi, type PublicClient } from 'viem'
import type {
  VaultWidgetConfig,
  VaultWidgetMode,
  VaultWidgetPositionSource,
  VaultWidgetPositionSourceState
} from '../types'

export function getAvailableVaultWidgetModes(
  configuredModes: readonly VaultWidgetMode[],
  migrationBalance: bigint
): readonly VaultWidgetMode[] {
  return configuredModes.filter((mode) => mode !== 'migrate' || migrationBalance > 0n)
}

export function isModeAvailabilityPending(
  requestedMode: VaultWidgetMode | undefined,
  account: `0x${string}` | undefined,
  positionSourcesLoading: boolean
): boolean {
  return requestedMode === 'migrate' && (!account || positionSourcesLoading)
}

export function getPositionSources(config: VaultWidgetConfig): readonly VaultWidgetPositionSource[] {
  if (config.positionSources?.length) return config.positionSources

  return [
    {
      id: 'default',
      label: config.display?.positionLabel ?? config.positionToken.symbol,
      token: config.positionToken,
      readAmount: config.readPositionAmount,
      readValue: config.readPositionValue
    }
  ]
}

export function getDefaultPositionSource(
  sources: readonly VaultWidgetPositionSource[],
  preferredId?: string
): VaultWidgetPositionSource {
  const source = sources.find(({ id }) => id === preferredId) ?? sources[0]
  if (!source) throw new Error('Vault widget requires at least one position source')
  return source
}

export function getSelectablePositionSources(
  sources: readonly VaultWidgetPositionSourceState[]
): readonly VaultWidgetPositionSourceState[] {
  const fundedSources = sources.filter(({ balance }) => balance > 0n)
  return fundedSources.length > 1 ? fundedSources : []
}

export function resolveWithdrawPositionSource(
  sources: readonly VaultWidgetPositionSourceState[],
  selectedId?: string
): VaultWidgetPositionSourceState {
  const unstakedSource = sources.find(({ id }) => id.toLowerCase() === 'vault') ?? sources[0]
  if (!unstakedSource) throw new Error('Vault widget requires at least one position source')

  const fundedSources = sources.filter(({ balance }) => balance > 0n)
  if (fundedSources.length === 0) return unstakedSource
  if (fundedSources.length === 1) return fundedSources[0]!
  return (
    fundedSources.find(({ id }) => id === selectedId) ??
    fundedSources.find(({ id }) => id === unstakedSource.id) ??
    fundedSources[0]!
  )
}

export async function readPositionSourceState(
  publicClient: PublicClient,
  account: `0x${string}`,
  source: VaultWidgetPositionSource
): Promise<VaultWidgetPositionSourceState> {
  const balance = await publicClient.readContract({
    address: source.token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account]
  })
  const value = source.readValue && balance > 0n ? await source.readValue(publicClient, balance) : balance
  return { ...source, balance, value }
}

export function sumPositionValues(sources: readonly VaultWidgetPositionSourceState[]): bigint {
  return sources.reduce((total, source) => total + source.value, 0n)
}
