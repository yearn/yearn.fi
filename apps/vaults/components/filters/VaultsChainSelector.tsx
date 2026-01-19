import { IconChevron } from '@lib/icons/IconChevron'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'

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
  isStacked?: boolean
  onSelectAllChains: () => void
  onSelectChain: (chainId: number) => void
  onOpenChainModal: () => void
}

export function VaultsChainSelector({
  chainButtons,
  areAllChainsSelected,
  allChainsLabel,
  showMoreChainsButton = true,
  isStacked = false,
  onSelectAllChains,
  onSelectChain,
  onOpenChainModal
}: TVaultsChainSelectorProps): ReactElement {
  return (
    <div
      className={cl(
        'flex h-10 items-stretch overflow-x-auto scrollbar-themed rounded-xl border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border',
        isStacked ? 'min-w-0 shrink-0' : 'min-w-0'
      )}
    >
      <button
        type={'button'}
        className={cl(
          'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
          'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary'
        )}
        data-active={areAllChainsSelected}
        onClick={onSelectAllChains}
        aria-pressed={areAllChainsSelected}
      >
        <span className={'size-5 overflow-hidden rounded-full'}>
          <LogoYearn className={'size-full'} back={'text-text-primary'} front={'text-surface'} />
        </span>
        <span className={'whitespace-nowrap'}>{allChainsLabel}</span>
      </button>
      {chainButtons.map((chain) => (
        <button
          key={chain.id}
          type={'button'}
          className={cl(
            'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
            'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
            'data-[active=true]:bg-surface data-[active=true]:text-text-primary'
          )}
          data-active={chain.isSelected}
          onClick={(): void => onSelectChain(chain.id)}
          aria-pressed={chain.isSelected}
          aria-label={chain.label}
        >
          {chain.icon ? (
            <span className={'size-5 overflow-hidden rounded-full bg-surface/80'}>{chain.icon}</span>
          ) : null}
          <span className={cl('whitespace-nowrap', chain.isSelected ? '' : 'hidden')}>{chain.label}</span>
        </button>
      ))}

      {showMoreChainsButton ? (
        <button
          type={'button'}
          className={cl(
            'flex h-full items-center gap-2 px-3 font-medium transition-colors',
            'text-text-secondary hover:bg-surface/30 hover:text-text-primary'
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
