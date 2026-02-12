import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import type { ReactElement } from 'react'
import { Fragment, useState } from 'react'
import { APYDetailsModal } from './APYDetailsModal'
import { ApyDisplay } from './ApyDisplay'
import { resolveHistoricalApyDisplayConfig } from './apyDisplayConfig'

type TVaultHistoricalAPYProps = {
  currentVault: TKongVaultInput
  className?: string
  valueClassName?: string
  showSublineTooltip?: boolean
  showBoostDetails?: boolean
}

export function VaultHistoricalAPY({
  currentVault,
  className,
  valueClassName,
  showSublineTooltip = true,
  showBoostDetails = true
}: TVaultHistoricalAPYProps): ReactElement {
  const data = useVaultApyData(currentVault)
  const [isModalOpen, setIsModalOpen] = useState(false)
  function openModal(): void {
    setIsModalOpen(true)
  }

  function closeModal(): void {
    setIsModalOpen(false)
  }

  const { displayConfig, modalConfig } = resolveHistoricalApyDisplayConfig({
    currentVault,
    data,
    showSublineTooltip,
    showBoostDetails,
    onRequestModalOpen: openModal
  })

  function handleValueClick(): void {
    if (!modalConfig?.canOpen) {
      return
    }
    openModal()
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
        <APYDetailsModal isOpen={isModalOpen} onClose={closeModal} title={modalConfig.title}>
          {modalConfig.content}
        </APYDetailsModal>
      ) : null}
    </Fragment>
  )
}
