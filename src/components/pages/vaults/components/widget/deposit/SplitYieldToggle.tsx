import { useKatanaAprs } from '@pages/vaults/hooks/splitter/useKatanaAprs'
import type { TSplitterWantToken } from '@pages/vaults/types/splitter'
import { Tooltip } from '@shared/components/Tooltip'
import { cl, formatApyDisplay } from '@shared/utils'
import type { FC } from 'react'
import type { Address } from 'viem'

interface SplitYieldToggleProps {
  vaultAddress: Address
  enabled: boolean
  onToggle: (enabled: boolean) => void
  selectedWant?: Address
  onSelectWant: (want: Address) => void
  wantTokens: Record<Address, TSplitterWantToken>
}

export const SplitYieldToggle: FC<SplitYieldToggleProps> = ({
  vaultAddress,
  enabled,
  onToggle,
  selectedWant,
  onSelectWant,
  wantTokens
}) => {
  const { nativeApy, rewardsApy } = useKatanaAprs(vaultAddress)
  const wantList = Object.values(wantTokens)

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">Split Yield</span>
          <Tooltip
            tooltip={
              <div className="max-w-[240px] p-2 text-xs">
                Your deposit earns yield which auto-compounds into a different vault token instead of the vault&apos;s
                native asset.
              </div>
            }
          >
            <span className="cursor-help text-text-secondary">
              <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7V7h2v5zM8 6a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </span>
          </Tooltip>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={cl(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
            enabled ? 'bg-blue-600' : 'bg-surface-tertiary'
          )}
        >
          <span
            className={cl(
              'pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform duration-200',
              enabled ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Yield token selector — only when enabled */}
      {enabled && wantList.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-secondary p-3">
          <span className="text-xs font-medium text-text-secondary">Compound yield into</span>
          <div className="flex gap-2">
            {wantList.map((token) => (
              <button
                key={token.address}
                type="button"
                onClick={() => onSelectWant(token.address)}
                className={cl(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  selectedWant === token.address
                    ? 'border-blue-600 bg-blue-600/10 text-blue-600'
                    : 'border-border bg-surface text-text-primary hover:border-text-secondary'
                )}
              >
                {token.symbol}
              </button>
            ))}
          </div>

          {/* APY info */}
          {selectedWant ? (
            <div className="flex flex-col gap-1 text-xs text-text-secondary">
              <div className="flex justify-between">
                <span>Compounded into {wantTokens[selectedWant]?.symbol}</span>
                <span className="font-number">{formatApyDisplay(nativeApy)}</span>
              </div>
              {rewardsApy > 0 ? (
                <div className="flex justify-between">
                  <span>External rewards</span>
                  <span className="font-number">{formatApyDisplay(rewardsApy)}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
