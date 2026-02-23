import { usePlausible } from '@hooks/usePlausible'
import { IconChevron } from '@shared/icons/IconChevron'
import { LogoYearn } from '@shared/icons/LogoYearn'
import { cl } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { ReactElement, RefObject } from 'react'

type TVaultsChainButton = {
  id: number
  label: string
  icon?: ReactElement
  isSelected: boolean
}

type TVaultsChainSelectorProps = {
  chainButtons: TVaultsChainButton[]
  areAllChainsSelected: boolean
  allChainsLabel: string
  showMoreChainsButton?: boolean
  isMinimal?: boolean
  enableResponsiveLayout?: boolean
  isStacked?: boolean
  onSelectAllChains: () => void
  onSelectChain: (chainId: number) => void
  onOpenChainModal: () => void
  selectorRef?: RefObject<HTMLDivElement | null>
}

export function VaultsChainSelector({
  chainButtons,
  areAllChainsSelected,
  allChainsLabel,
  showMoreChainsButton = true,
  isMinimal = true,
  enableResponsiveLayout = false,
  isStacked = false,
  onSelectAllChains,
  onSelectChain,
  onOpenChainModal,
  selectorRef
}: TVaultsChainSelectorProps): ReactElement {
  const trackEvent = usePlausible()
  function handleSelectAllChains(): void {
    trackEvent(PLAUSIBLE_EVENTS.FILTER_CHAIN, { props: { value: 'all' } })
    onSelectAllChains()
  }

  function handleSelectChain(chainId: number): void {
    trackEvent(PLAUSIBLE_EVENTS.FILTER_CHAIN, { props: { value: chainId.toString() } })
    onSelectChain(chainId)
  }

  return (
    <div
      ref={selectorRef}
      className={cl(
        'flex h-10 items-stretch overflow-x-auto scrollbar-themed rounded-lg border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border',
        isStacked ? 'min-w-0 shrink-0' : enableResponsiveLayout ? 'min-w-0' : 'w-full'
      )}
    >
      <button
        type={'button'}
        className={cl(
          'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
          'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/50 data-[active=false]:hover:text-text-primary',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary data-[active=true]:font-semibold',
          !enableResponsiveLayout && !isStacked ? 'flex-1' : ''
        )}
        data-active={areAllChainsSelected}
        onClick={handleSelectAllChains}
        aria-pressed={areAllChainsSelected}
      >
        <span className={'size-5 overflow-hidden rounded-full'}>
          <LogoYearn className={'size-full'} back={'text-text-primary'} front={'text-surface'} />
        </span>
        <span className={'whitespace-nowrap'}>{allChainsLabel}</span>
      </button>
      {chainButtons.map((chain) => {
        const showChainLabel = !isMinimal || chain.isSelected
        return (
          <button
            key={chain.id}
            type={'button'}
            className={cl(
              'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
              'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/50 data-[active=false]:hover:text-text-primary',
              'data-[active=true]:bg-surface data-[active=true]:text-text-primary data-[active=true]:font-semibold',
              !enableResponsiveLayout && !isStacked ? 'flex-1' : ''
            )}
            data-active={chain.isSelected}
            onClick={(): void => handleSelectChain(chain.id)}
            aria-pressed={chain.isSelected}
            aria-label={showChainLabel ? undefined : chain.label}
          >
            {chain.icon ? (
              <span className={'size-5 overflow-hidden rounded-full bg-surface/80'}>{chain.icon}</span>
            ) : null}
            {showChainLabel ? <span className={'whitespace-nowrap'}>{chain.label}</span> : null}
          </button>
        )
      })}

      {showMoreChainsButton ? (
        <button
          type={'button'}
          className={cl(
            'flex h-full items-center gap-2 px-3 font-medium transition-colors',
            'text-text-secondary hover:bg-surface/50 hover:text-text-primary'
          )}
          onClick={onOpenChainModal}
        >
          <span className={'whitespace-nowrap'}>{'More'}</span>
          <span className={'flex items-center'}>
            <IconChevron direction={'right'} className={'size-4'} />
            <IconChevron direction={'right'} className={'-ml-3 size-4'} />
          </span>
        </button>
      ) : null}
    </div>
  )
}

export type { TVaultsChainButton }
