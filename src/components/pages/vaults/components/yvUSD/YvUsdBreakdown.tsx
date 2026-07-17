import {
  type TYvUsdPositionApyBreakdown,
  YVUSD_DESCRIPTION,
  YVUSD_LOCKED_COOLDOWN_DAYS,
  YVUSD_WITHDRAW_WINDOW_DAYS
} from '@pages/vaults/utils/yvUsd'
import { RenderAmount } from '@shared/components/RenderAmount'
import { IconInfinifiPoints } from '@shared/icons/IconInfinifiPoints'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, formatAmount, formatApyDisplay, formatUSD } from '@shared/utils'
import type { ReactElement } from 'react'

type TYvUsdTooltipProps = {
  lockedValue: number
  unlockedValue: number
  className?: string
  iconClassName?: string
  unlockedIconClassName?: string
  infinifiPointsNote?: string
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
  iconClassName = 'size-3',
  unlockedIconClassName,
  infinifiPointsNote
}: TYvUsdTooltipProps): ReactElement {
  const resolvedUnlockedIconClassName = unlockedIconClassName ?? iconClassName.replace(/size-(\S+)/, 'h-$1 w-4')
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
          icon={<IconLockOpen className={resolvedUnlockedIconClassName} />}
          label="Unlocked APY"
          value={unlockedValue}
          symbol="percent"
          options={{ maximumFractionDigits: 2, minimumFractionDigits: 2 }}
        />
        {infinifiPointsNote ? (
          <div className="border-t border-border pt-2">
            <p className="flex items-start gap-2 text-text-secondary">
              <IconInfinifiPoints className="mt-0.5 size-3.5 shrink-0" aria-label="Infinifi points" />
              <span>{infinifiPointsNote}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function YvUsdPositionApyRow({
  icon,
  label,
  position
}: {
  icon: ReactElement
  label: string
  position: TYvUsdPositionApyBreakdown['locked']
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="flex min-w-0 flex-col">
          <span className="text-text-primary">{label}</span>
          <span className="whitespace-nowrap text-[11px] text-text-secondary">
            {`${formatApyDisplay(position.weight)} of position · ${formatUSD(position.value)}`}
          </span>
        </span>
      </div>
      <strong className="shrink-0 font-semibold text-text-primary">
        {position.apy === null ? '—' : formatApyDisplay(position.apy)}
      </strong>
    </div>
  )
}

export function YvUsdPositionApyTooltipContent({
  breakdown,
  className
}: {
  breakdown: TYvUsdPositionApyBreakdown
  className?: string
}): ReactElement {
  return (
    <div
      className={cl(
        'min-w-64 rounded-xl border border-border bg-surface-secondary p-3 text-xs text-text-primary',
        className
      )}
    >
      <p className="mb-2 font-semibold text-text-primary">{'Your yvUSD APY breakdown'}</p>
      <div className="flex flex-col gap-2">
        <YvUsdPositionApyRow icon={<IconLock className="size-3" />} label="Locked" position={breakdown.locked} />
        <YvUsdPositionApyRow
          icon={<IconLockOpen className="h-3 w-4" />}
          label="Unlocked"
          position={breakdown.unlocked}
        />
      </div>
    </div>
  )
}

export function YvUsdTvlTooltipContent({
  lockedValue,
  unlockedValue,
  className,
  iconClassName = 'size-3',
  unlockedIconClassName
}: TYvUsdTooltipProps): ReactElement {
  const resolvedUnlockedIconClassName = unlockedIconClassName ?? iconClassName.replace(/size-(\S+)/, 'h-$1 w-4')
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
          icon={<IconLockOpen className={resolvedUnlockedIconClassName} />}
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
  unlockedValue,
  infinifiPointsNote
}: {
  lockedValue: number
  unlockedValue: number
  infinifiPointsNote?: string
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
            infinifiPointsNote={infinifiPointsNote}
          />
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        {`Locked deposits currently show about ${upliftPercent}% APY uplift and require a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown. Withdrawals are open for ${YVUSD_WITHDRAW_WINDOW_DAYS} days once the cooldown ends.`}
      </p>
    </div>
  )
}
