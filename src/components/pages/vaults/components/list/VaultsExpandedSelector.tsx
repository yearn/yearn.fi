import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement } from 'react'

export type TVaultsExpandedView = 'apy' | 'performance' | 'tvl' | 'strategies' | 'user-balance' | 'user-growth'

type Props = {
  activeView: TVaultsExpandedView
  onViewChange: (view: TVaultsExpandedView) => void
  className?: string
  rightElement?: ReactElement
  viewOptions?: Array<{ id: TVaultsExpandedView; label: string }>
}

const DEFAULT_VIEW_OPTIONS: Array<{ id: TVaultsExpandedView; label: string }> = [
  { id: 'strategies', label: 'Strategies' },
  { id: 'apy', label: 'APY' },
  { id: 'performance', label: 'Performance' },
  { id: 'tvl', label: 'TVL' }
]

function groupOptions(
  options: Array<{ id: TVaultsExpandedView; label: string }>,
  size = 2
): Array<Array<{ id: TVaultsExpandedView; label: string }>> {
  return Array.from({ length: Math.ceil(options.length / size) }, (_unused, index) =>
    options.slice(index * size, index * size + size)
  )
}

export function VaultsExpandedSelector({
  activeView,
  onViewChange,
  className,
  rightElement,
  viewOptions = DEFAULT_VIEW_OPTIONS
}: Props): ReactElement {
  const viewGroups = groupOptions(viewOptions)

  return (
    <div className={cl('flex w-full items-stretch gap-2', className)}>
      <div className={cl('flex-1', SELECTOR_BAR_STYLES.container)}>
        <div className={'flex flex-wrap gap-1'}>
          {viewGroups.map((group) => (
            <div key={group.map((option) => option.id).join('-')} className={'flex flex-1 gap-1'}>
              {group.map((option) => (
                <button
                  key={option.id}
                  type={'button'}
                  className={cl(
                    'flex-1 rounded-lg px-3 py-2 text-xs font-semibold tracking-wide transition-colors whitespace-nowrap',
                    SELECTOR_BAR_STYLES.buttonBase,
                    activeView === option.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                  )}
                  onClick={(): void => onViewChange(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {rightElement ? <div className={'flex items-stretch'}>{rightElement}</div> : null}
    </div>
  )
}
