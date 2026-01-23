import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { Fragment, useState } from 'react'
import { APYDetailsModal } from './APYDetailsModal'
import { ApyDisplay } from './ApyDisplay'
import { resolveHistoricalApyDisplayConfig } from './apyDisplayConfig'

export function VaultHistoricalAPY({
  currentVault,
  className,
  valueClassName,
  showSublineTooltip = true,
  showBoostDetails = true
}: {
  currentVault: TYDaemonVault
  className?: string
  valueClassName?: string
  showSublineTooltip?: boolean
  showBoostDetails?: boolean
}): ReactElement {
  const data = useVaultApyData(currentVault)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { displayConfig, modalConfig } = resolveHistoricalApyDisplayConfig({
    currentVault,
    data,
    showSublineTooltip,
    showBoostDetails,
    onRequestModalOpen: (): void => setIsModalOpen(true)
  })

  const handleValueClick = (): void => {
    if (!modalConfig?.canOpen) {
      return
    }
    setIsModalOpen(true)
  }

  return (
    <Fragment>
      <ApyDisplay
        config={displayConfig}
        className={className}
        valueClassName={valueClassName}
        onValueClick={handleValueClick}
      />
      {modalConfig?.canOpen ? (
        <APYDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalConfig.title}>
          {modalConfig.content}
        </APYDetailsModal>
      ) : null}
    </Fragment>
  )
}
