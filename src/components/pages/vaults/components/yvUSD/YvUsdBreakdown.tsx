import { YVUSD_LOCKED_COOLDOWN_DAYS } from '@pages/vaults/utils/yvUsd'
import { RenderAmount } from '@shared/components/RenderAmount'
import { IconInfinifiPoints } from '@shared/icons/IconInfinifiPoints'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl } from '@shared/utils'
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
