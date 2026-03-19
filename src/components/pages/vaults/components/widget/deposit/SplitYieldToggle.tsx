import Link from '@components/Link'
import {
  getSplitterRoutesForVault,
  getVaultAssetType,
  getWantDisplayName,
  getWantVaultSymbol,
  KATANA_CHAIN_ID
} from '@pages/vaults/constants/addresses'
import { useKatanaAprs } from '@pages/vaults/hooks/splitter/useKatanaAprs'
import { Tooltip } from '@shared/components/Tooltip'
import { cl, formatApyDisplay, toAddress } from '@shared/utils'
import { type FC, useMemo } from 'react'
import type { Address } from 'viem'

interface SplitYieldToggleProps {
  vaultAddress: Address
  selectedWant?: Address
  onSelectWant: (want: Address | undefined) => void
}

export const SplitYieldToggle: FC<SplitYieldToggleProps> = ({ vaultAddress, selectedWant, onSelectWant }) => {
  const { rewardsApy } = useKatanaAprs(vaultAddress)
  const assetType = getVaultAssetType(vaultAddress)

  const wantOptions = useMemo(() => {
    const routes = getSplitterRoutesForVault(vaultAddress)
    const seen = new Set<string>()
    const options: { address: Address; name: string }[] = []
    for (const r of routes) {
      const name = getWantDisplayName(r.want)
      if (!name || seen.has(r.want)) continue
      seen.add(r.want)
      if (assetType === 'usd' ? name !== 'USD' : name === 'USD') {
        options.push({ address: r.want as Address, name })
      }
    }
    return options
  }, [vaultAddress, assetType])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Tooltip
          tooltip={
            <div className="max-w-[240px] rounded-lg border border-border bg-surface-secondary p-3 text-xs text-text-primary shadow-lg">
              {'Choose an asset to auto-convert your vault yield into instead of compounding natively.'}
            </div>
          }
        >
          <span className="text-sm font-medium text-text-primary underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:decoration-neutral-600">
            {'Optionally earn your yield in:'}
          </span>
        </Tooltip>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border">
            {wantOptions.map((option) => {
              const isSelected = selectedWant === option.address
              return (
                <button
                  key={option.address}
                  type="button"
                  onClick={() => onSelectWant(isSelected ? undefined : option.address)}
                  className={cl(
                    'px-3 py-1 text-xs font-semibold transition-colors first:rounded-l-[7px] last:rounded-r-[7px]',
                    isSelected ? 'bg-surface-tertiary text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {option.name}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(selectedWant)}
            onClick={() => onSelectWant(selectedWant ? undefined : wantOptions[0]?.address)}
            className={cl(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              selectedWant ? 'bg-blue-600' : 'bg-surface-tertiary'
            )}
          >
            <span
              className={cl(
                'pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform duration-200',
                selectedWant ? 'translate-x-4' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      {/* Info message + APY — only when selected */}
      {selectedWant ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-secondary p-3">
          <p className="text-xs text-text-secondary">
            <span className="mr-1">ℹ</span>
            {'Your native vault yield will auto-convert into '}
            <Link
              href={`/vaults/${KATANA_CHAIN_ID}/${toAddress(selectedWant)}`}
              className="font-medium text-text-primary underline hover:text-blue-500"
            >
              {getWantVaultSymbol(selectedWant)}
            </Link>
          </p>

          {rewardsApy > 0 ? (
            <div className="flex justify-between text-xs text-text-secondary">
              <span>{'Rewards APY'}</span>
              <span className="font-number">{formatApyDisplay(rewardsApy)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
