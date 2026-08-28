import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement } from 'react'

type TYvUsdVariant = 'locked' | 'unlocked'

type Props = {
  activeVariant: TYvUsdVariant
  onChange: (variant: TYvUsdVariant) => void
}

const VARIANT_OPTIONS: { id: TYvUsdVariant; label: string; icon: ReactElement }[] = [
  { id: 'locked', label: 'Locked', icon: <IconLock className="size-3" /> },
  { id: 'unlocked', label: 'Unlocked', icon: <IconLockOpen className="size-3" /> }
]

export function YvUsdVariantToggle({ activeVariant, onChange }: Props): ReactElement {
  return (
    <div className={cl('flex items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}>
      {VARIANT_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cl(
            'flex-1 md:flex-initial rounded-sm px-2 md:px-3 h-[36px] md:h-[26px] text-xs font-semibold transition-all',
            'active:scale-[0.98] whitespace-nowrap',
            SELECTOR_BAR_STYLES.buttonBase,
            activeVariant === option.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
          )}
        >
          <span className="inline-flex items-center gap-1">
            {option.icon}
            {option.label}
          </span>
        </button>
      ))}
    </div>
  )
}
