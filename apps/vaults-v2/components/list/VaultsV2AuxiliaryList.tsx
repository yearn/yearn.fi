import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultsListRow } from '@vaults-v2/components/list/VaultsListRow'

import type { ReactElement } from 'react'

export type TVaultFlagsRecord = Record<
  string,
  {
    hasHoldings: boolean
    isMigratable: boolean
    isRetired: boolean
  }
>

type TVaultsV2AuxiliaryListProps = {
  title?: string
  vaults: TYDaemonVault[]
  vaultFlags: TVaultFlagsRecord
}

export function VaultsV2AuxiliaryList({ title, vaults, vaultFlags }: TVaultsV2AuxiliaryListProps): ReactElement | null {
  if (vaults.length === 0) {
    return null
  }

  return (
    <div className={'flex flex-col gap-3'}>
      {title ? <p className={'px-10 text-xs font-semibold uppercase tracking-wide text-neutral-600'}>{title}</p> : null}
      <div className={'grid gap-0'}>
        {vaults.map((vault) => {
          const key = `${vault.chainID}_${toAddress(vault.address)}`
          return <VaultsListRow key={key} currentVault={vault} flags={vaultFlags[key]} />
        })}
      </div>
    </div>
  )
}
