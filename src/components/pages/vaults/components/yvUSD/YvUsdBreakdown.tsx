import { YVUSD_DESCRIPTION, YVUSD_LOCKED_COOLDOWN_DAYS, YVUSD_WITHDRAW_WINDOW_DAYS } from '@pages/vaults/utils/yvUsd'
import { RenderAmount } from '@shared/components/RenderAmount'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, formatAmount } from '@shared/utils'
import type { ReactElement } from 'react'

type TYvUsdTooltipProps = {
  lockedValue: number
  unlockedValue: number
  className?: string
  iconClassName?: string
}

const YvUsdTooltipRow = ({
  icon,
  label,
  value,
  symbol,
  options
}: {
  icon: ReactElement
  label: string
  value: number
  symbol: 'percent' | 'USD'
  options?: {
    maximumFractionDigits?: number
    minimumFractionDigits?: number
    shouldCompactValue?: boolean
  }
}) => {
  const decimals = symbol === 'percent' ? 6 : 0
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 text-text-secondary">
        {icon}
        {label}
      </span>
      <RenderAmount value={value} symbol={symbol} decimals={decimals} options={options} />
    </div>
  )
}

export function YvUsdApyTooltipContent({
  lockedValue,
  unlockedValue,
  className,
  iconClassName = 'size-3'
}: TYvUsdTooltipProps): ReactElement {
  return (
    <div
      className={cl('rounded-xl border border-border bg-surface-secondary p-2 text-xs text-text-primary', className)}
    >
      <div className="flex flex-col gap-2">
        <YvUsdTooltipRow
          icon={<IconLock className={iconClassName} />}
          label="Locked APY"
          value={lockedValue}
          symbol="percent"
          options={{ maximumFractionDigits: 2, minimumFractionDigits: 2 }}
        />
        <YvUsdTooltipRow
          icon={<IconLockOpen className={iconClassName} />}
          label="Unlocked APY"
          value={unlockedValue}
          symbol="percent"
          options={{ maximumFractionDigits: 2, minimumFractionDigits: 2 }}
        />
      </div>
    </div>
  )
}

export function YvUsdTvlTooltipContent({
  lockedValue,
  unlockedValue,
  className,
  iconClassName = 'size-3'
}: TYvUsdTooltipProps): ReactElement {
  return (
    <div
      className={cl('rounded-xl border border-border bg-surface-secondary p-2 text-xs text-text-primary', className)}
    >
      <div className="flex flex-col gap-2">
        <YvUsdTooltipRow
          icon={<IconLock className={iconClassName} />}
          label="Locked TVL"
          value={lockedValue}
          symbol="USD"
          options={{ shouldCompactValue: true, maximumFractionDigits: 2, minimumFractionDigits: 0 }}
        />
        <YvUsdTooltipRow
          icon={<IconLockOpen className={iconClassName} />}
          label="Unlocked TVL"
          value={unlockedValue}
          symbol="USD"
          options={{ shouldCompactValue: true, maximumFractionDigits: 2, minimumFractionDigits: 0 }}
        />
      </div>
    </div>
  )
}

export function YvUsdApyDetailsContent({
  lockedValue,
  unlockedValue
}: {
  lockedValue: number
  unlockedValue: number
}): ReactElement {
  const upliftPercent = formatAmount(Math.max(0, (lockedValue - unlockedValue) * 100), 0, 2)

  return (
    <div className="space-y-4">
      <p>{YVUSD_DESCRIPTION}</p>
      <div className="rounded-lg border border-border bg-surface-secondary p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{'Current estimates'}</p>
        <div className="mt-2">
          <YvUsdApyTooltipContent
            lockedValue={lockedValue}
            unlockedValue={unlockedValue}
            className="border-0 bg-transparent p-0"
          />
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        {`Locked deposits currently show about ${upliftPercent}% APY uplift and require a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown. Withdrawals are open for ${YVUSD_WITHDRAW_WINDOW_DAYS} days once the cooldown ends.`}
      </p>
    </div>
  )
}
