import { YVUSD_DESCRIPTION, YVUSD_LOCKED_COOLDOWN_DAYS, YVUSD_WITHDRAW_WINDOW_DAYS } from '@pages/vaults/utils/yvUsd'
import { RenderAmount } from '@shared/components/RenderAmount'
import { IconInfinifiPoints } from '@shared/icons/IconInfinifiPoints'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, formatAmount } from '@shared/utils'
import type { ReactElement } from 'react'

type TYvUsdTooltipProps = {
  lockedValue: number
  unlockedValue: number
  className?: string
  iconClassName?: string
  unlockedIconClassName?: string
  infinifiPointsNote?: string
  onRequestMoreInfo?: () => void
}

const YVUSD_TOOLTIP_CTA_CLASS =
  'mt-1 block font-semibold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 ' +
  'transition-opacity hover:decoration-neutral-600'

const YvUsdTooltipRow = ({
  icon,
  label,
  value,
  symbol,
  options,
  iconGapClassName = 'gap-2'
}: {
  icon: ReactElement
  label: string
  value: number
  symbol: 'percent' | 'USD'
  iconGapClassName?: string
  options?: {
    maximumFractionDigits?: number
    minimumFractionDigits?: number
    shouldCompactValue?: boolean
  }
}) => {
  const decimals = symbol === 'percent' ? 6 : 0
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cl('inline-flex items-center text-text-secondary', iconGapClassName)}>
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
  infinifiPointsNote,
  onRequestMoreInfo
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
          iconGapClassName="gap-1"
          options={{ maximumFractionDigits: 2, minimumFractionDigits: 2 }}
        />
        <div className="space-y-1 border-t border-border pt-2 text-text-secondary">
          <p>
            <span className="font-semibold text-text-primary">{'Locked:'}</span>{' '}
            {`Shares require a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown before withdrawal.`}
          </p>
          <p>
            <span className="font-semibold text-text-primary">{'Unlocked:'}</span>{' '}
            {'Shares can be withdrawn without a cooldown.'}
          </p>
        </div>
        {infinifiPointsNote ? (
          <div className="border-t border-border pt-2">
            <p className="flex items-start gap-2 text-text-secondary">
              <IconInfinifiPoints className="mt-0.5 size-3.5 shrink-0" aria-label="Infinifi points" />
              <span>{infinifiPointsNote}</span>
            </p>
          </div>
        ) : null}
        {onRequestMoreInfo ? (
          <button
            type={'button'}
            data-tooltip-close={'true'}
            className={YVUSD_TOOLTIP_CTA_CLASS}
            onClick={onRequestMoreInfo}
          >
            {'Click for more information'}
          </button>
        ) : null}
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
