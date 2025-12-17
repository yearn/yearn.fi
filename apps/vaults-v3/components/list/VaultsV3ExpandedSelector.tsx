import { cl } from '@lib/utils'
import {
  type TVaultChartTimeframe,
  VAULT_CHART_TIMEFRAME_OPTIONS
} from '@nextgen/components/vaults-beta/VaultChartsSection'
import type { ReactElement } from 'react'

export type TVaultsV3ExpandedView = 'apy' | 'performance' | 'info'

type Props = {
  activeView: TVaultsV3ExpandedView
  onViewChange: (view: TVaultsV3ExpandedView) => void
  timeframe: TVaultChartTimeframe
  onTimeframeChange: (timeframe: TVaultChartTimeframe) => void
}

const VIEW_OPTIONS: Array<{ id: TVaultsV3ExpandedView; label: string }> = [
  { id: 'apy', label: 'APY' },
  { id: 'performance', label: 'Performance' },
  { id: 'info', label: 'Vault Info' }
]

export function VaultsV3ExpandedSelector({
  activeView,
  onViewChange,
  timeframe,
  onTimeframeChange
}: Props): ReactElement {
  return (
    <div className={'flex flex-wrap items-center justify-between gap-3 px-6 pt-4'}>
      <div className={'flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner'}>
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type={'button'}
            className={cl(
              'rounded-lg px-4 py-1 text-xs font-semibold tracking-wide transition-colors',
              activeView === option.id
                ? 'bg-surface text-text-primary'
                : 'bg-transparent text-text-secondary hover:text-text-secondary'
            )}
            onClick={(): void => onViewChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {activeView !== 'info' ? (
        <div className={'flex items-center gap-1 rounded-lg bg-app p-1'}>
          {VAULT_CHART_TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type={'button'}
              className={cl(
                'rounded-lg px-4 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                option.value === timeframe
                  ? 'bg-surface text-text-primary'
                  : 'bg-transparent text-text-secondary hover:text-text-secondary'
              )}
              onClick={(): void => onTimeframeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
