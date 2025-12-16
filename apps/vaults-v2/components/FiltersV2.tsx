import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

type TChainButton = {
  id: number
  label: string
  icon?: ReactElement
  isSelected: boolean
}

type TFiltersV2Props = {
  chains: number[] | null
  searchValue: string
  onChangeChains: (chains: number[] | null) => void
  onSearch: (searchValue: string) => void
  shouldDebounce?: boolean
  holdingsVaults: TYDaemonVault[]
}

const V2_SUPPORTED_CHAINS = [1, 10, 250, 42161]

export const FiltersV2: React.FC<TFiltersV2Props> = ({
  chains,
  searchValue,
  onChangeChains,
  onSearch,
  shouldDebounce
}) => {
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
    </div>
  )
}
