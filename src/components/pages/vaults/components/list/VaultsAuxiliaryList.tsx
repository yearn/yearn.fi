import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { VirtualizedVaultsList } from '@pages/vaults/components/list/VirtualizedVaultsList'
import type { TVaultForwardAPYVariant } from '@pages/vaults/components/table/VaultForwardAPY'
import { getVaultAddress, getVaultChainID, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { cl, toAddress } from '@shared/utils'

import type { ReactElement } from 'react'

export type TVaultFlagsRecord = Record<
  string,
  {
    hasHoldings: boolean
    isMigratable: boolean
    isRetired: boolean
  }
>

type TVaultsAuxiliaryListProps = {
  title?: string
  vaults: TKongVaultInput[]
  vaultFlags: TVaultFlagsRecord
  apyDisplayVariant?: TVaultForwardAPYVariant
  resolveApyDisplayVariant?: (vault: TKongVaultInput) => TVaultForwardAPYVariant
  compareVaultKeys?: string[]
  onToggleCompare?: (vault: TKongVaultInput) => void
  activeChains?: number[]
  activeCategories?: string[]
  activeProductType?: 'v3' | 'lp' | 'all'
  activeFeeStructureKey?: string | null
  onToggleChain?: (chainId: number) => void
  onToggleCategory?: (category: string) => void
  onToggleType?: (type: string) => void
  onToggleVaultType?: (type: 'v3' | 'lp') => void
  onToggleFeeStructure?: (feeStructureKey: string) => void
  showStrategies?: boolean
  shouldCollapseChips?: boolean
  expandedVaultKeys?: Record<string, boolean>
  onExpandedChange?: (vaultKey: string, next: boolean) => void
}

function getVaultListKey(vault: TKongVaultInput): string {
  return `${getVaultChainID(vault)}_${toAddress(getVaultAddress(vault))}`
}

// TODO: the contents of this component override the type filers. This should only happen for HOLDINGS and not AVAILABLE TO DEPOSIT
export function VaultsAuxiliaryList({
  title,
  vaults,
  vaultFlags,
  apyDisplayVariant,
  resolveApyDisplayVariant,
  compareVaultKeys,
  onToggleCompare,
  activeChains,
  activeCategories,
  activeProductType,
  activeFeeStructureKey,
  onToggleChain,
  onToggleCategory,
  onToggleType,
  onToggleVaultType,
  onToggleFeeStructure,
  showStrategies,
  shouldCollapseChips,
  expandedVaultKeys,
  onExpandedChange
}: TVaultsAuxiliaryListProps): ReactElement | null {
  if (vaults.length === 0) {
    return null
  }

  return (
    <div className={cl('flex flex-col gap-2 border-b border-border', title ? 'pb-3' : '')}>
      {title ? (
        <p className={'px-4 text-xs font-semibold uppercase tracking-wide text-text-secondary md:px-8'}>{title}</p>
      ) : null}
      <VirtualizedVaultsList
        items={vaults}
        estimateSize={81}
        itemSpacingClassName={'pb-px'}
        getItemKey={getVaultListKey}
        renderItem={(vault): ReactElement => {
          const key = getVaultListKey(vault)
          const rowApyDisplayVariant = resolveApyDisplayVariant?.(vault) ?? apyDisplayVariant
          const isExpanded = expandedVaultKeys ? Boolean(expandedVaultKeys[key]) : undefined
          return (
            <VaultsListRow
              currentVault={vault}
              flags={vaultFlags[key]}
              apyDisplayVariant={rowApyDisplayVariant}
              compareVaultKeys={compareVaultKeys}
              onToggleCompare={onToggleCompare}
              activeChains={activeChains}
              activeCategories={activeCategories}
              activeProductType={activeProductType}
              activeFeeStructureKey={activeFeeStructureKey}
              onToggleChain={onToggleChain}
              onToggleCategory={onToggleCategory}
              onToggleType={onToggleType}
              onToggleVaultType={onToggleVaultType}
              onToggleFeeStructure={onToggleFeeStructure}
              shouldCollapseChips={shouldCollapseChips}
              showStrategies={showStrategies}
              isExpanded={isExpanded}
              onExpandedChange={onExpandedChange}
            />
          )
        }}
      />
    </div>
  )
}
