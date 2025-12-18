import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconCross } from '@lib/icons/IconCross'
import { IconFilter } from '@lib/icons/IconFilter'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { Fragment, useMemo, useState } from 'react'

type TChainButton = {
  id: number
  label: string
  icon?: ReactElement
  isSelected: boolean
}

type TFiltersV2Props = {
  types: string[] | null
  categories: string[] | null
  protocols: string[] | null
  chains: number[] | null
  searchValue: string
  onChangeChains: (chains: number[] | null) => void
  onSearch: (searchValue: string) => void
  onChangeTypes: (types: string[] | null) => void
  onChangeCategories: (categories: string[] | null) => void
  onChangeProtocols: (protocols: string[] | null) => void
  shouldDebounce?: boolean
  holdingsVaults: TYDaemonVault[]
}

const V2_SUPPORTED_CHAINS = [1, 10, 42161]

export const FiltersV2: React.FC<TFiltersV2Props> = ({
  types,
  categories,
  protocols,
  chains,
  searchValue,
  onChangeChains,
  onSearch,
  onChangeTypes,
  onChangeCategories,
  onChangeProtocols,
  shouldDebounce
}) => {
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)
  const allChainOptions = useChainOptions(chains)

  const chainOptions = useMemo(
    () => allChainOptions.filter((option) => V2_SUPPORTED_CHAINS.includes(Number(option.value))),
    [allChainOptions]
  )

  const chainOptionMap = useMemo(() => {
    const map = new Map<number, (typeof chainOptions)[0]>()
    for (const option of chainOptions) {
      map.set(Number(option.value), option)
    }
    return map
  }, [chainOptions])

  const selectedChainSet = useMemo(() => new Set(chains ?? []), [chains])

  const chainButtons = useMemo((): TChainButton[] => {
    return V2_SUPPORTED_CHAINS.map((id) => {
      const option = chainOptionMap.get(id)
      if (!option) {
        return null
      }
      return {
        id,
        label: option.label,
        icon: option.icon,
        isSelected: selectedChainSet.has(id)
      }
    }).filter(Boolean) as TChainButton[]
  }, [chainOptionMap, selectedChainSet])

  const areAllChainsSelected = !chains || chains.length === 0

  const handleSelectAllChains = (): void => {
    onChangeChains(null)
  }

  const handleChainToggle = (chainId: number): void => {
    if (chains && chains.length === 1 && chains[0] === chainId) {
      onChangeChains(null)
      return
    }
    onChangeChains([chainId])
  }

  const kindOptions = [
    { value: 'factory', label: 'Factory' },
    { value: 'legacy', label: 'Legacy' }
  ]

  const assetCategoryOptions = [
    { value: 'Stablecoin', label: 'Stablecoin' },
    { value: 'Volatile', label: 'Volatile' }
  ]

  const protocolOptions = [
    'Curve',
    'Velodrome',
    'Aerodrome',
    'Balancer',
    'Fluid',
    'Morpho',
    'Aave',
    'Sky',
    'Silo',
    'Compound'
  ]

  const selectedFacetCount = (types?.length ?? 0) + (categories?.length ?? 0) + (protocols?.length ?? 0)

  return (
    <div className={'relative col-span-24 w-full rounded-lg border border-border bg-surface mt-2 p-2 md:col-span-19'}>
      <div className={'md:hidden'}>
        <div className={'mb-5 w-full'}>
          <p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
          <SearchBar
            className={
              'max-w-none rounded-lg border-none bg-surface-secondary text-text-primary transition-all md:w-full'
            }
            iconClassName={'text-text-primary'}
            searchPlaceholder={'YFI Vault'}
            searchValue={searchValue}
            onSearch={onSearch}
            shouldDebounce={shouldDebounce || false}
            highlightWhenActive={true}
          />
        </div>
        <div className={'flex flex-wrap gap-2'}>
          <button
            type={'button'}
            className={cl(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all border',
              areAllChainsSelected
                ? 'border-border bg-surface text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
            onClick={handleSelectAllChains}
          >
            <span className={'size-5 overflow-hidden rounded-full'}>
              <LogoYearn
                className={'size-full'}
                back={areAllChainsSelected ? 'text-text-primary' : 'text-text-secondary'}
                front={'text-surface'}
              />
            </span>
            <span>{'All'}</span>
          </button>
          {chainButtons.map((chain) => (
            <button
              key={chain.id}
              type={'button'}
              className={cl(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all border',
                chain.isSelected
                  ? 'border-border bg-surface text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
              onClick={(): void => handleChainToggle(chain.id)}
            >
              {chain.icon ? <span className={'size-5 overflow-hidden rounded-full'}>{chain.icon}</span> : null}
              <span>{chain.label}</span>
            </button>
          ))}
        </div>
        <button
          type={'button'}
          className={cl(
            'mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary'
          )}
          onClick={(): void => setIsFiltersModalOpen(true)}
        >
          <IconFilter className={'size-4'} />
          <span>{'Filters'}</span>
          {selectedFacetCount > 0 ? (
            <span
              className={
                'ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-surface-tertiary px-1.5 text-xs text-text-primary'
              }
            >
              {selectedFacetCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className={'hidden md:block'}>
        <div className={'flex flex-col gap-4'}>
          <div className={'flex flex-col gap-2'}>
            <div className={'flex w-full flex-wrap justify-between items-center gap-3'}>
              <div
                className={
                  'flex h-10 shrink-0 items-stretch overflow-hidden rounded-md border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border'
                }
              >
                <button
                  type={'button'}
                  className={cl(
                    'flex h-full items-center gap-2 px-3 font-medium transition-colors',
                    'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
                    'data-[active=true]:bg-surface data-[active=true]:text-text-primary'
                  )}
                  data-active={areAllChainsSelected}
                  onClick={handleSelectAllChains}
                  aria-pressed={areAllChainsSelected}
                >
                  <span className={'size-5 overflow-hidden rounded-full'}>
                    <LogoYearn className={'size-full'} back={'text-text-primary'} front={'text-surface'} />
                  </span>
                  <span className={'whitespace-nowrap'}>{'All'}</span>
                </button>
                {chainButtons.map((chain) => (
                  <button
                    key={chain.id}
                    type={'button'}
                    className={cl(
                      'flex h-full items-center gap-2 px-3 font-medium transition-colors',
                      'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
                      'data-[active=true]:bg-surface data-[active=true]:text-text-primary'
                    )}
                    data-active={chain.isSelected}
                    onClick={(): void => handleChainToggle(chain.id)}
                    aria-pressed={chain.isSelected}
                  >
                    {chain.icon ? (
                      <span className={'size-5 overflow-hidden rounded-full bg-surface/80'}>{chain.icon}</span>
                    ) : null}
                    <span className={'whitespace-nowrap'}>{chain.label}</span>
                  </button>
                ))}
              </div>
              <div className={'flex flex-row items-center gap-3 min-w-[300px] max-w-[500px] flex-1'}>
                <button
                  type={'button'}
                  className={cl(
                    'flex shrink-0 items-center gap-1 border rounded-lg h-10 border-border px-4 py-2 text-sm font-medium text-text-secondary bg-surface transition-colors hover:text-text-primary'
                  )}
                  onClick={(): void => setIsFiltersModalOpen(true)}
                  aria-label={'Open filters'}
                >
                  <IconFilter className={'size-4'} />
                  <span>{'Filters'}</span>
                  {selectedFacetCount > 0 ? (
                    <span
                      className={
                        'ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-surface-tertiary px-1.5 text-xs text-text-primary'
                      }
                    >
                      {selectedFacetCount}
                    </span>
                  ) : null}
                </button>
                <SearchBar
                  className={'w-full rounded-lg border-border bg-surface text-text-primary transition-all'}
                  iconClassName={'text-text-primary'}
                  searchPlaceholder={'Find a Vault'}
                  searchValue={searchValue}
                  onSearch={onSearch}
                  shouldDebounce={shouldDebounce || false}
                  highlightWhenActive={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <VaultV2FiltersModal
        isOpen={isFiltersModalOpen}
        onClose={(): void => setIsFiltersModalOpen(false)}
        kindOptions={kindOptions}
        selectedKinds={types}
        onChangeKinds={onChangeTypes}
        assetCategoryOptions={assetCategoryOptions}
        selectedCategories={categories}
        onChangeCategories={onChangeCategories}
        protocolOptions={protocolOptions}
        selectedProtocols={protocols}
        onChangeProtocols={onChangeProtocols}
      />
    </div>
  )
}

function VaultV2FiltersModal({
  isOpen,
  onClose,
  kindOptions,
  selectedKinds,
  onChangeKinds,
  assetCategoryOptions,
  selectedCategories,
  onChangeCategories,
  protocolOptions,
  selectedProtocols,
  onChangeProtocols
}: {
  isOpen: boolean
  onClose: () => void
  kindOptions: Array<{ value: string; label: string }>
  selectedKinds: string[] | null
  onChangeKinds: (kinds: string[] | null) => void
  assetCategoryOptions: Array<{ value: string; label: string }>
  selectedCategories: string[] | null
  onChangeCategories: (categories: string[] | null) => void
  protocolOptions: string[]
  selectedProtocols: string[] | null
  onChangeProtocols: (protocols: string[] | null) => void
}): ReactElement {
  const toggleString = (current: string[] | null, next: string): string[] => {
    const existing = current ?? []
    if (existing.includes(next)) {
      return existing.filter((value) => value !== next)
    }
    return [...existing, next]
  }

  const clearAll = (): void => {
    onChangeKinds([])
    onChangeCategories([])
    onChangeProtocols([])
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-[70]'} onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter={'duration-200 ease-out'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'duration-150 ease-in'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-black/40'} />
        </TransitionChild>
        <div className={'fixed inset-0 overflow-y-auto'}>
          <div className={'flex min-h-full items-center justify-center p-4'}>
            <TransitionChild
              as={Fragment}
              enter={'duration-200 ease-out'}
              enterFrom={'opacity-0 scale-95'}
              enterTo={'opacity-100 scale-100'}
              leave={'duration-150 ease-in'}
              leaveFrom={'opacity-100 scale-100'}
              leaveTo={'opacity-0 scale-95'}
            >
              <Dialog.Panel
                className={
                  'w-full max-w-3xl rounded-3xl border border-border bg-surface p-6 text-text-primary shadow-lg'
                }
              >
                <div className={'flex items-start justify-between gap-4'}>
                  <Dialog.Title className={'text-lg font-semibold text-text-primary'}>{'Filters'}</Dialog.Title>
                  <button
                    type={'button'}
                    onClick={onClose}
                    className={
                      'inline-flex size-8 items-center justify-center rounded-full border border-transparent text-text-secondary hover:border-border hover:text-text-primary'
                    }
                    aria-label={'Close filters'}
                  >
                    <IconCross className={'size-4'} />
                  </button>
                </div>

                <div className={'mt-4 grid grid-cols-1 gap-6 md:grid-cols-2'}>
                  <div className={'flex flex-col gap-6'}>
                    <div>
                      <p className={'mb-2 text-sm text-text-secondary'}>{'Asset Category'}</p>
                      <div className={'space-y-2'}>
                        {assetCategoryOptions.map((option) => {
                          const isChecked = Boolean(selectedCategories?.includes(option.value))
                          return (
                            <label
                              key={option.value}
                              className={cl(
                                'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                                isChecked
                                  ? 'border-border bg-surface-tertiary/80'
                                  : 'border-border hover:bg-surface-tertiary/40'
                              )}
                            >
                              <span className={'text-sm font-medium text-text-primary'}>{option.label}</span>
                              <input
                                type={'checkbox'}
                                className={'checkbox accent-blue-500'}
                                checked={isChecked}
                                onChange={(): void =>
                                  onChangeCategories(toggleString(selectedCategories, option.value))
                                }
                              />
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <details className={'rounded-xl border border-border bg-surface-secondary p-4'}>
                      <summary className={'cursor-pointer text-sm font-semibold text-text-primary'}>
                        {'Advanced'}
                      </summary>
                      <div className={'mt-4'}>
                        <p className={'mb-2 text-sm text-text-secondary'}>{'Vault Kind'}</p>
                        <div className={'space-y-2'}>
                          {kindOptions.map((option) => {
                            const isChecked = Boolean(selectedKinds?.includes(option.value))
                            return (
                              <label
                                key={option.value}
                                className={cl(
                                  'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                                  isChecked
                                    ? 'border-border bg-surface-tertiary/80'
                                    : 'border-border hover:bg-surface-tertiary/40'
                                )}
                              >
                                <span className={'text-sm font-medium text-text-primary'}>{option.label}</span>
                                <input
                                  type={'checkbox'}
                                  className={'checkbox accent-blue-500'}
                                  checked={isChecked}
                                  onChange={(): void => onChangeKinds(toggleString(selectedKinds, option.value))}
                                />
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </details>
                  </div>

                  <div className={'flex flex-col gap-6'}>
                    <div>
                      <p className={'mb-2 text-sm text-text-secondary'}>{'Protocol'}</p>
                      <div className={'max-h-[320px] space-y-2 overflow-y-auto pr-1'}>
                        {protocolOptions.map((protocol) => {
                          const isChecked = Boolean(selectedProtocols?.includes(protocol))
                          return (
                            <label
                              key={protocol}
                              className={cl(
                                'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                                isChecked
                                  ? 'border-border bg-surface-tertiary/80'
                                  : 'border-border hover:bg-surface-tertiary/40'
                              )}
                            >
                              <span className={'text-sm font-medium text-text-primary'}>{protocol}</span>
                              <input
                                type={'checkbox'}
                                className={'checkbox accent-blue-500'}
                                checked={isChecked}
                                onChange={(): void => onChangeProtocols(toggleString(selectedProtocols, protocol))}
                              />
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={'mt-6 flex justify-end gap-3'}>
                  <button
                    type={'button'}
                    className={
                      'rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-border-hover'
                    }
                    onClick={clearAll}
                  >
                    {'Clear'}
                  </button>
                  <button
                    type={'button'}
                    className={
                      'rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-neutral-800'
                    }
                    onClick={onClose}
                  >
                    {'Done'}
                  </button>
                </div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
