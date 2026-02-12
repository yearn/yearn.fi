import { RenderAmount } from '@shared/components/RenderAmount'
import { Tooltip } from '@shared/components/Tooltip'
import { getVaultTVL, getVaultToken, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { cl, formatTvlDisplay, toNormalizedBN } from '@shared/utils'
import type { ReactElement } from 'react'

type TVaultTVLProps = {
  currentVault: TKongVaultInput
  className?: string
  valueClassName?: string
  showNativeTooltip?: boolean
  tooltipClassName?: string
}

export function VaultTVL({
  currentVault,
  className,
  valueClassName,
  showNativeTooltip = false,
  tooltipClassName
}: TVaultTVLProps): ReactElement {
  const tvl = getVaultTVL(currentVault)
  const token = getVaultToken(currentVault)
  const tvlValue = tvl?.tvl ?? 0
  const normalizedTVL = toNormalizedBN(tvl?.totalAssets ?? 0, token.decimals).normalized
  const tvlNativeTooltip = (
    <div className={'rounded-lg border border-border bg-surface-secondary p-2 text-xs text-text-primary'}>
      <span className={'font-number'}>
        <RenderAmount
          value={Number(normalizedTVL)}
          symbol={''}
          decimals={6}
          shouldFormatDust
          options={{
            shouldCompactValue: true,
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
          }}
        />
      </span>
      <span className={'pl-1'}>{token.symbol}</span>
    </div>
  )

  const value = (
    <span className={cl('yearn--table-data-section-item-value font-semibold', valueClassName)}>
      {formatTvlDisplay(tvlValue)}
    </span>
  )

  const content = showNativeTooltip ? (
    <Tooltip
      className={cl('tvl-subline-tooltip gap-0 h-auto', tooltipClassName)}
      openDelayMs={150}
      toggleOnClick={false}
      tooltip={tvlNativeTooltip}
    >
      {value}
    </Tooltip>
  ) : (
    value
  )

  if (!className) {
    return content
  }

  return <span className={className}>{content}</span>
}
