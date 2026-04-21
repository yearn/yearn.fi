import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { Fragment, forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { APYDetailsModal } from './APYDetailsModal'
import { ApyDisplay } from './ApyDisplay'
import { resolveForwardApyDisplayConfig } from './apyDisplayConfig'

export type TVaultForwardAPYVariant = 'default' | 'factory-list'

export type TVaultForwardAPYHandle = {
  openModal: () => void
}

type TVaultForwardAPYProps = {
  currentVault: TKongVaultInput
  onMobileToggle?: (e: React.MouseEvent) => void
  className?: string
  valueClassName?: string
  showSubline?: boolean
  showSublineTooltip?: boolean
  displayVariant?: TVaultForwardAPYVariant
  showBoostDetails?: boolean
  onInteractiveHoverChange?: (isHovering: boolean) => void
  containerClassName?: string
  isContainerInteractive?: boolean
}

export const VaultForwardAPY = forwardRef<TVaultForwardAPYHandle, TVaultForwardAPYProps>(function VaultForwardAPY(
  {
    currentVault,
    onMobileToggle,
    className,
    valueClassName,
    showSubline = true,
    showSublineTooltip = false,
    displayVariant = 'default',
    showBoostDetails = true,
    onInteractiveHoverChange,
    containerClassName,
    isContainerInteractive = false
  }: TVaultForwardAPYProps,
  ref
): ReactElement {
  const data = useVaultApyData(currentVault)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const canOpenModal = displayVariant !== 'factory-list'
  const openModal = useCallback((): void => {
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback((): void => {
    setIsModalOpen(false)
  }, [])

  useImperativeHandle(ref, () => ({ openModal }), [openModal])

  const { displayConfig, modalConfig } = resolveForwardApyDisplayConfig({
    currentVault,
    data,
    displayVariant,
    showSubline,
    showSublineTooltip,
    showBoostDetails,
    canOpenModal,
    onRequestModalOpen: openModal
  })

  function handleValueClick(e: React.MouseEvent): void {
    if (onMobileToggle) {
      e.preventDefault()
      e.stopPropagation()
      onMobileToggle(e)
      return
    }
    if (!modalConfig?.canOpen) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    openModal()
  }

  const shouldWrap = Boolean(containerClassName || isContainerInteractive)
  const handleContainerClick = isContainerInteractive
    ? (e: React.MouseEvent): void => {
        handleValueClick(e)
      }
    : undefined

  const handleContainerKeyDown = isContainerInteractive
    ? (e: React.KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') {
          return
        }
        e.preventDefault()
        handleValueClick(e as unknown as React.MouseEvent)
      }
    : undefined

  const apyDisplay = (
    <ApyDisplay
      config={displayConfig}
      className={className}
      valueClassName={valueClassName}
      onValueClick={handleValueClick}
      onHoverChange={onInteractiveHoverChange}
    />
  )

  return (
    <Fragment>
      {shouldWrap ? (
        <div
          className={cl(containerClassName, isContainerInteractive ? 'cursor-pointer' : undefined)}
          role={isContainerInteractive ? 'button' : undefined}
          tabIndex={isContainerInteractive ? 0 : undefined}
          onClick={handleContainerClick}
          onKeyDown={handleContainerKeyDown}
        >
          {apyDisplay}
        </div>
      ) : (
        apyDisplay
      )}
      {modalConfig?.canOpen ? (
        <APYDetailsModal isOpen={isModalOpen} onClose={closeModal} title={modalConfig.title}>
          {modalConfig.content}
        </APYDetailsModal>
      ) : null}
    </Fragment>
  )
})
