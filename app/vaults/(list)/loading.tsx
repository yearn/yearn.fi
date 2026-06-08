import { VaultsListRowSkeleton } from '@pages/vaults/components/list/VaultsListRowSkeleton'
import { getVaultTypeLabel, type TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { IconFilter } from '@shared/icons/IconFilter'
import { IconGitCompare } from '@shared/icons/IconGitCompare'
import { IconSearch } from '@shared/icons/IconSearch'
import { LogoYearn } from '@shared/icons/LogoYearn'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

const SKELETON_ROWS = Array.from({ length: 8 }, (_, index) => index)
const VAULT_TYPE_FILTERS: TVaultType[] = ['all', 'v3', 'factory']
const CHAIN_FILTERS = [
  { label: 'All Chains', icon: 'yearn' },
  { label: 'Ethereum', icon: 'E' },
  { label: 'Katana', icon: 'K' },
  { label: 'Base', icon: 'B' },
  { label: 'OP Mainnet', icon: 'O' }
] as const

function DisabledVaultTypeToggle({ stretch = false }: { stretch?: boolean }): ReactElement {
  return (
    <div
      aria-disabled={true}
      className={
        'flex h-10 shrink-0 items-stretch overflow-hidden rounded-lg border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border opacity-70'
      }
    >
      {VAULT_TYPE_FILTERS.map((vaultType) => (
        <button
          key={vaultType}
          type={'button'}
          disabled={true}
          className={cl(
            'flex h-full items-center justify-center gap-1 px-4 font-medium',
            vaultType === 'all'
              ? 'bg-surface font-semibold text-text-primary'
              : 'cursor-not-allowed text-text-secondary',
            stretch ? 'flex-1' : ''
          )}
          aria-pressed={vaultType === 'all'}
        >
          <span className={'whitespace-nowrap'}>{getVaultTypeLabel(vaultType)}</span>
        </button>
      ))}
    </div>
  )
}

function DisabledChainIcon({ icon }: { icon: (typeof CHAIN_FILTERS)[number]['icon'] }): ReactElement {
  if (icon === 'yearn') {
    return (
      <span className={'size-5 overflow-hidden rounded-full'}>
        <LogoYearn className={'size-full'} back={'text-text-primary'} front={'text-surface'} />
      </span>
    )
  }

  return (
    <span
      aria-hidden={true}
      className={
        'flex size-5 items-center justify-center rounded-full bg-surface text-[10px] font-semibold text-text-secondary'
      }
    >
      {icon}
    </span>
  )
}

function DisabledChainSelector(): ReactElement {
  return (
    <div
      aria-disabled={true}
      className={
        'flex h-10 w-full items-stretch overflow-x-auto scrollbar-themed rounded-lg border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border opacity-70'
      }
    >
      {CHAIN_FILTERS.map((chain) => (
        <button
          key={chain.label}
          type={'button'}
          disabled={true}
          className={cl(
            'flex h-full flex-1 cursor-not-allowed items-center justify-center gap-1 px-2 font-medium',
            chain.label === 'All Chains' ? 'bg-surface font-semibold text-text-primary' : 'text-text-secondary'
          )}
          aria-pressed={chain.label === 'All Chains'}
          aria-label={chain.label === 'All Chains' ? undefined : chain.label}
        >
          <DisabledChainIcon icon={chain.icon} />
          {chain.label === 'All Chains' ? <span className={'whitespace-nowrap'}>{chain.label}</span> : null}
        </button>
      ))}
    </div>
  )
}

function DisabledFiltersButton(): ReactElement {
  return (
    <button
      type={'button'}
      disabled={true}
      className={
        'relative flex h-10 w-[34px] shrink-0 cursor-not-allowed items-center justify-center gap-1 overflow-visible rounded-lg border border-border bg-surface py-2 text-sm font-medium text-text-secondary opacity-70 min-[1075px]:w-auto min-[1075px]:px-4'
      }
      aria-label={'Open filters'}
    >
      <IconFilter className={'size-4 shrink-0'} />
      <span className={'hidden min-[1075px]:inline'}>{'Filters'}</span>
    </button>
  )
}

function DisabledCompareButton(): ReactElement {
  return (
    <button
      type={'button'}
      disabled={true}
      className={
        'flex h-10 shrink-0 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-secondary opacity-70'
      }
    >
      <IconGitCompare className={'size-4'} />
      {'Compare'}
    </button>
  )
}

function DisabledSearchBar(): ReactElement {
  return (
    <div
      aria-disabled={true}
      className={
        'flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-surface px-2 text-text-primary opacity-70'
      }
    >
      <div className={'flex h-full w-full items-center gap-2 overflow-hidden'}>
        <input
          id={'vaults-loading-search'}
          disabled={true}
          className={
            'h-full min-w-0 flex-1 cursor-not-allowed bg-transparent py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none'
          }
          type={'text'}
          placeholder={'Find a Vault'}
          value={''}
          readOnly={true}
        />
        <div
          className={'flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded text-text-primary'}
        >
          <IconSearch className={'size-4'} />
        </div>
      </div>
    </div>
  )
}

function DisabledMobileFilters(): ReactElement {
  return (
    <div className={'md:hidden'}>
      <div className={'mb-2 w-full'}>
        <DisabledVaultTypeToggle stretch={true} />
      </div>
      <div className={'mb-2 w-full'}>
        <button
          type={'button'}
          disabled={true}
          className={
            'flex h-10 w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary opacity-70'
          }
        >
          <div className={'flex items-center gap-2'}>
            <DisabledChainIcon icon={'yearn'} />
            <span>{'All Chains'}</span>
          </div>
        </button>
      </div>
      <div className={'flex w-full items-center gap-1'}>
        <button
          type={'button'}
          disabled={true}
          className={
            'flex h-10 flex-1 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-surface text-sm font-medium text-text-secondary opacity-70'
          }
        >
          {'Filter Vaults'}
        </button>
        <DisabledCompareButton />
        <button
          type={'button'}
          disabled={true}
          className={
            'flex size-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-surface text-text-secondary opacity-70'
          }
          aria-label={'Search vaults'}
        >
          <IconSearch className={'size-4'} />
        </button>
      </div>
    </div>
  )
}

function DisabledDesktopFilters(): ReactElement {
  return (
    <div className={'hidden md:block'}>
      <div className={'flex flex-col gap-4'}>
        <div>
          <div className={'flex flex-col gap-2'}>
            <div className={'flex w-full flex-wrap items-center gap-3'}>
              <div className={'shrink-0'}>
                <DisabledVaultTypeToggle />
              </div>
              <div className={'min-w-0 max-w-[580px] shrink'}>
                <DisabledChainSelector />
              </div>
              <div className={'flex min-w-0 flex-1 flex-row items-center gap-1.5'}>
                <DisabledFiltersButton />
                <DisabledCompareButton />
                <div className={'min-w-0 flex-1'}>
                  <DisabledSearchBar />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VaultsLoadingFilters(): ReactElement {
  return (
    <div className={'relative col-span-24 w-full md:col-span-19'} data-tour="vaults-filters">
      <DisabledMobileFilters />
      <DisabledDesktopFilters />
    </div>
  )
}

export default function Loading(): ReactElement {
  return (
    <main className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4 pb-4'}>
        <div className={'flex flex-col'}>
          <div className={'sticky z-40 w-full shrink-0 bg-app pb-2'} style={{ top: 'var(--header-height)' }}>
            <Breadcrumbs
              className={'mb-3 px-1'}
              items={[
                { label: 'Home', href: '/' },
                { label: 'Vaults', href: '/vaults', isCurrent: true }
              ]}
            />
            <VaultsLoadingFilters />
          </div>

          <div className={'overflow-hidden rounded-lg border border-border'}>
            {SKELETON_ROWS.map((rowIndex) => (
              <VaultsListRowSkeleton
                key={`vaults-loading-row-${rowIndex}`}
                className={rowIndex === SKELETON_ROWS.length - 1 ? undefined : 'border-b border-border'}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
