import { useThrottledState } from '@react-hookz/web'
import { EmptyState } from '@shared/components/EmptyState'
import type { TMultiSelectOptionProps } from '@shared/components/MultiSelectDropdown'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCross } from '@shared/icons/IconCross'
import { IconSearch } from '@shared/icons/IconSearch'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'

type TVaultsAssetFilterProps = {
  options: TMultiSelectOptionProps[]
  onSelect: (options: TMultiSelectOptionProps[]) => void
  buttonLabel?: string
}

function renderAssetOption(
  option: TMultiSelectOptionProps,
  onSelectSingle: (option: TMultiSelectOptionProps) => void,
  onToggle: (option: TMultiSelectOptionProps) => void
): ReactNode {
  return (
    <div
      key={option.value}
      className={cl(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
        option.isSelected ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
      )}
    >
      <button
        type={'button'}
        className={'flex min-w-0 flex-1 items-center gap-2 text-left'}
        onClick={(): void => onSelectSingle(option)}
      >
        {option.icon ? (
          <div className={cl('size-8 overflow-hidden rounded-full', option.label === 'Sonic' ? 'bg-white' : '')}>
            {option.icon}
          </div>
        ) : null}
        <span className={'truncate text-sm font-medium text-text-primary'}>{option.label}</span>
      </button>
      <input
        type={'checkbox'}
        className={'checkbox accent-blue-500'}
        checked={option.isSelected}
        onChange={(): void => onToggle(option)}
        readOnly
      />
    </div>
  )
}

function renderAssetFilterSelected(buttonTitle: string, isOpen: boolean): ReactNode {
  return (
    <>
      <p className={'truncate text-sm font-medium text-text-primary'}>{buttonTitle}</p>
      <IconChevron
        aria-hidden={'true'}
        className={`size-4 text-text-secondary transition-transform ${isOpen ? '-rotate-180' : 'rotate-0'}`}
      />
    </>
  )
}

export function VaultsAssetFilter({
  options,
  onSelect,
  buttonLabel = 'Filter by assets'
}: TVaultsAssetFilterProps): ReactElement {
  const [isOpen, setIsOpen] = useThrottledState(false, 400)
  const [query, setQuery] = useState('')

  const selectedOptions = useMemo(() => options.filter((option) => option.isSelected), [options])
  const selectedCount = selectedOptions.length
  const buttonTitle = selectedCount > 0 ? `${buttonLabel} (${selectedCount})` : buttonLabel

  const filteredOptions = useMemo((): TMultiSelectOptionProps[] => {
    if (query.trim() === '') {
      return options
    }
    const loweredQuery = query.toLowerCase()
    return options.filter((option) => option.label.toLowerCase().includes(loweredQuery))
  }, [options, query])

  const handleClose = useCallback((): void => {
    setIsOpen(false)
    setQuery('')
  }, [setIsOpen])

  const handleSelectSingle = useCallback(
    (option: TMultiSelectOptionProps): void => {
      const nextState = options.map((current) =>
        current.value === option.value ? { ...current, isSelected: true } : { ...current, isSelected: false }
      )
      onSelect(nextState)
    },
    [onSelect, options]
  )

  const handleToggleOption = useCallback(
    (option: TMultiSelectOptionProps): void => {
      const nextState = options.map((current) =>
        current.value === option.value ? { ...current, isSelected: !current.isSelected } : current
      )
      onSelect(nextState)
    },
    [onSelect, options]
  )

  const handleClear = useCallback((): void => {
    const nextState = options.map((option) => ({ ...option, isSelected: false }))
    onSelect(nextState)
  }, [onSelect, options])

  const hasSelection = selectedOptions.length > 0

  return (
    <div className={'w-full'}>
      <button
        type={'button'}
        onClick={(): void => setIsOpen(true)}
        className={
          'flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left'
        }
      >
        {renderAssetFilterSelected(buttonTitle, isOpen)}
      </button>

      {isOpen ? (
        <div
          className={'absolute inset-0 z-30 flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-lg'}
        >
          <div className={'flex items-center justify-between gap-3'}>
            <div>
              <p className={'text-base font-semibold text-text-primary'}>{'Filter by assets'}</p>
              <p className={'text-xs text-text-secondary'}>{'Pick one or more assets to include.'}</p>
            </div>
            <div className={'flex items-center gap-2'}>
              <button
                type={'button'}
                onClick={handleClear}
                disabled={!hasSelection}
                className={cl(
                  'rounded-full border border-border px-3 py-1 text-xs font-medium text-text-primary transition-colors',
                  hasSelection ? 'hover:border-border-hover' : 'cursor-not-allowed opacity-50'
                )}
              >
                {'Clear'}
              </button>
              <button
                type={'button'}
                onClick={handleClose}
                className={
                  'inline-flex size-8 items-center justify-center rounded-full border border-transparent text-text-secondary hover:border-border hover:text-text-primary'
                }
                aria-label={'Close asset filter'}
              >
                <IconCross className={'size-4'} />
              </button>
            </div>
          </div>

          <div className={'mt-4'}>
            <div className={'flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2'}>
              <IconSearch className={'size-4 text-text-secondary'} />
              <input
                type={'search'}
                value={query}
                onChange={(event): void => setQuery(event.target.value)}
                placeholder={'Search assets'}
                className={'w-full bg-transparent text-sm text-text-primary outline-hidden'}
                aria-label={'Search assets'}
              />
              {query ? (
                <button
                  type={'button'}
                  onClick={(): void => setQuery('')}
                  className={'text-xs text-text-secondary hover:text-text-primary'}
                >
                  {'Clear'}
                </button>
              ) : null}
            </div>
          </div>

          <div className={'mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden'}>
            <div className={'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1'}>
              {filteredOptions.length === 0 ? (
                <EmptyState
                  title={'No assets found.'}
                  size={'sm'}
                  unstyled
                  className={'rounded-lg border border-dashed border-border px-3 py-6'}
                />
              ) : (
                filteredOptions.map((option) => renderAssetOption(option, handleSelectSingle, handleToggleOption))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
