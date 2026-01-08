import { cl, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'
import type { TVaultForwardAPYVariant } from '@vaults-v3/components/table/VaultForwardAPY'

import type { ReactElement } from 'react'

export type TVaultFlagsRecord = Record<
  string,
  {
    hasHoldings: boolean
    isMigratable: boolean
    isRetired: boolean
  }
>

type TVaultsV3AuxiliaryListProps = {
  title?: string
  vaults: TYDaemonVault[]
  vaultFlags: TVaultFlagsRecord
  apyDisplayVariant?: TVaultForwardAPYVariant
  resolveApyDisplayVariant?: (vault: TYDaemonVault) => TVaultForwardAPYVariant
  activeChains?: number[]
  activeCategories?: string[]
  activeProductType?: 'v3' | 'lp' | 'all'
  onToggleChain?: (chainId: number) => void
  onToggleCategory?: (category: string) => void
  onToggleType?: (type: string) => void
  onToggleVaultType?: (type: 'v3' | 'lp') => void
  showStrategies?: boolean
  layoutVariant?: 'default' | 'balanced'
}

// TODO: the contents of this component override the type filers. This should only happen for HOLDINGS and not AVAILABLE TO DEPOSIT
export function VaultsV3AuxiliaryList({
  title,
  vaults,
  vaultFlags,
  apyDisplayVariant,
  resolveApyDisplayVariant,
  activeChains,
  activeCategories,
  activeProductType,
  onToggleChain,
  onToggleCategory,
  onToggleType,
  onToggleVaultType,
  showStrategies,
  layoutVariant
}: TVaultsV3AuxiliaryListProps): ReactElement | null {
  if (vaults.length === 0) {
    return null
  }

  return (
    <div className={'flex flex-col gap-2 border-b border-border pb-3'}>
      {title ? (
        <p className={cl('px-4 text-xs font-semibold uppercase tracking-wide text-text-secondary md:px-8')}>{title}</p>
      ) : null}
      <div className={'flex flex-col gap-px'}>
        {vaults.map((vault) => {
          const key = `${vault.chainID}_${toAddress(vault.address)}`
          const rowApyDisplayVariant = resolveApyDisplayVariant ? resolveApyDisplayVariant(vault) : apyDisplayVariant
          return (
            <VaultsV3ListRow
              key={key}
              currentVault={vault}
              flags={vaultFlags[key]}
              apyDisplayVariant={rowApyDisplayVariant}
              activeChains={activeChains}
              activeCategories={activeCategories}
              activeProductType={activeProductType}
              onToggleChain={onToggleChain}
              onToggleCategory={onToggleCategory}
              onToggleType={onToggleType}
              onToggleVaultType={onToggleVaultType}
              showStrategies={showStrategies}
              layoutVariant={layoutVariant}
            />
          )
        })}
      </div>
    </div>
  )
}
