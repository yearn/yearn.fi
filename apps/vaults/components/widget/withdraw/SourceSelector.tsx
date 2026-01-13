import type { FC } from 'react'
import type { WithdrawalSource } from './types'

interface SourceSelectorProps {
  value: WithdrawalSource
  onChange: (source: WithdrawalSource) => void
}

export const SourceSelector: FC<SourceSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="px-6 pb-4">
      <div className="flex flex-col gap-2">
        <label className="font-medium text-sm text-text-primary">Withdraw from</label>
        <div className="relative">
          <select
            value={value || ''}
            onChange={(e) => onChange((e.target.value as WithdrawalSource) || null)}
            className="bg-surface border border-border rounded-md h-9 w-full px-3 py-2 text-sm text-text-primary appearance-none pr-10"
          >
            <option value="">Not selected</option>
            <option value="vault">Vault shares</option>
            <option value="staking">Staking contract</option>
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
