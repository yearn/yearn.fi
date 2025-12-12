import { cl, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'

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
}

// TODO: the contents of this component override the type filers. This should only happen for HOLDINGS and not AVAILABLE TO DEPOSIT
export function VaultsV3AuxiliaryList({ title, vaults, vaultFlags }: TVaultsV3AuxiliaryListProps): ReactElement | null {
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
          return <VaultsV3ListRow key={key} currentVault={vault} flags={vaultFlags[key]} />
        })}
      </div>
    </div>
  )
}
