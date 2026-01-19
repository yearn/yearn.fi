import { cl } from '@lib/utils'
import type { ReactElement } from 'react'

export type TPendingFiltersState = {
  categories: string[]
  aggressiveness: string[]
  showStrategies: boolean
  showLegacyVaults: boolean
  showHiddenVaults: boolean
}

export type TFiltersConfig = {
  categoryOptions: string[]
  aggressivenessOptions: string[]
  toggleOptions: Array<{
    key: 'showStrategies' | 'showLegacyVaults' | 'showHiddenVaults'
    label: string
    description?: string
  }>
}

type TFilterChecklistOption = {
  label: string
  checked: boolean
  onToggle: () => void
}

type TFilterToggleOption = {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

type TVaultsFiltersPanelSection =
  | {
      type: 'checklist'
      title: string
      options: TFilterChecklistOption[]
      className?: string
    }
  | {
      type: 'advanced'
      title: string
      toggles: TFilterToggleOption[]
      className?: string
    }

function renderChecklist(section: Extract<TVaultsFiltersPanelSection, { type: 'checklist' }>): ReactElement | null {
  if (!section.options.length) {
    return null
  }

  return (
    <div className={cl('flex flex-col gap-6', section.className)}>
      <div>
        <p className={'mb-2 text-sm text-text-secondary'}>{section.title}</p>
        <div className={'space-y-2'}>
          {section.options.map((option) => (
            <label
              key={`${section.title}-${option.label}`}
              className={cl(
                'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                option.checked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
              )}
            >
              <span className={'text-sm font-medium text-text-primary'}>{option.label}</span>
              <input
                type={'checkbox'}
                className={'checkbox accent-blue-500'}
                checked={option.checked}
                onChange={option.onToggle}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function renderAdvancedSection(
  section: Extract<TVaultsFiltersPanelSection, { type: 'advanced' }>
): ReactElement | null {
  if (!section.toggles.length) {
    return null
  }

  return (
    <div className={section.className}>
      <details className={'rounded-xl border border-border bg-surface-secondary p-4'}>
        <summary className={'cursor-pointer text-sm font-semibold text-text-primary'}>{section.title}</summary>
        <span className={'text-sm'}>
          {' '}
          ⚠️ It is not recommended to deposit to strategies, legacy vaults, or hidden vaults.
        </span>
        <div className={'mt-4 flex flex-col gap-2'}>
          {section.toggles.map((toggle) => (
            <label
              key={`${section.title}-${toggle.label}`}
              className={
                'flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2'
              }
            >
              <div className={'min-w-0'}>
                <p className={'text-sm font-medium text-text-primary'}>{toggle.label}</p>
                {toggle.description ? <p className={'text-xs text-text-secondary'}>{toggle.description}</p> : null}
              </div>
              <input
                type={'checkbox'}
                className={'checkbox accent-blue-500'}
                checked={toggle.checked}
                onChange={(event): void => toggle.onChange(event.target.checked)}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}

export function VaultsFiltersPanel({ sections }: { sections: TVaultsFiltersPanelSection[] }): ReactElement | null {
  const renderedSections = sections
    .map((section) => {
      if (section.type === 'checklist') {
        return renderChecklist(section)
      }
      return renderAdvancedSection(section)
    })
    .filter(Boolean) as ReactElement[]

  if (renderedSections.length === 0) {
    return null
  }

  return <div className={'mt-4 flex flex-col gap-6'}>{renderedSections}</div>
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  if (arr.includes(value)) {
    return arr.filter((item) => item !== value)
  }
  return [...arr, value]
}

export function VaultsFiltersPanelControlled({
  config,
  state,
  onStateChange
}: {
  config: TFiltersConfig
  state: TPendingFiltersState
  onStateChange: (state: TPendingFiltersState) => void
}): ReactElement | null {
  const sections: TVaultsFiltersPanelSection[] = [
    {
      type: 'checklist',
      title: 'Asset Category',
      options: config.categoryOptions.map((value) => ({
        label: value,
        checked: state.categories.includes(value),
        onToggle: (): void => {
          onStateChange({ ...state, categories: toggleInArray(state.categories, value) })
        }
      }))
    },
    {
      type: 'checklist',
      title: 'Vault Aggressiveness',
      options: config.aggressivenessOptions.map((value) => ({
        label: value,
        checked: state.aggressiveness.includes(value),
        onToggle: (): void => {
          onStateChange({ ...state, aggressiveness: toggleInArray(state.aggressiveness, value) })
        }
      }))
    },
    {
      type: 'advanced',
      title: 'Advanced',
      toggles: config.toggleOptions.map((toggle) => ({
        label: toggle.label,
        description: toggle.description,
        checked: state[toggle.key],
        onChange: (checked: boolean): void => {
          onStateChange({ ...state, [toggle.key]: checked })
        }
      }))
    }
  ]

  return <VaultsFiltersPanel sections={sections} />
}

export type { TVaultsFiltersPanelSection, TFilterChecklistOption, TFilterToggleOption }
