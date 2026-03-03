import type { TSplitterPosition } from '@pages/vaults/types/splitter'
import type { FC } from 'react'
import type { Address } from 'viem'
import type { WithdrawalSource } from './types'

interface SourceSelectorProps {
  value: WithdrawalSource
  onChange: (source: WithdrawalSource) => void
  splitterPositions?: Record<Address, TSplitterPosition>
  onSelectSplitterStrategy?: (strategy: Address) => void
}

export const SourceSelector: FC<SourceSelectorProps> = ({
  value,
  onChange,
  splitterPositions,
  onSelectSplitterStrategy
}) => {
  const splitterEntries = Object.values(splitterPositions || {})

  return (
    <div className="">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <select
            value={value || ''}
            onChange={(e) => {
              const val = e.target.value
              if (val.startsWith('splitter:')) {
                const strategyAddr = val.slice('splitter:'.length) as Address
                onChange('splitter')
                onSelectSplitterStrategy?.(strategyAddr)
              } else {
                onChange((val as WithdrawalSource) || null)
              }
            }}
            className="bg-surface border border-border rounded-md h-9 w-full px-3 py-2 text-sm text-text-primary appearance-none pr-10"
          >
            <option value="">Select Withdrawal Source</option>
            <option value="vault">Vault shares</option>
            <option value="staking">Staking contract</option>
            {splitterEntries.map((pos) => (
              <option key={pos.strategyAddress} value={`splitter:${pos.strategyAddress}`}>
                Yield Splitter → {pos.wantToken.symbol}
              </option>
            ))}
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
