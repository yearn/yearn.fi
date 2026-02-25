import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { FC } from 'react'

type TYvUsdVariant = 'locked' | 'unlocked'

type Props = {
  activeVariant: TYvUsdVariant
  onChange: (variant: TYvUsdVariant) => void
}

export const YvUsdVariantToggle: FC<Props> = ({ activeVariant, onChange }) => {
  return (
    <div className={cl('flex items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}>
      <button
        type="button"
        onClick={() => onChange('locked')}
        className={cl(
          'flex-1 md:flex-initial rounded-sm px-2 md:px-3 h-[36px] md:h-[26px] text-xs font-semibold transition-all',
          'active:scale-[0.98] whitespace-nowrap',
          SELECTOR_BAR_STYLES.buttonBase,
          activeVariant === 'locked' ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
        )}
      >
        <span className="inline-flex items-center gap-1">
          <IconLock className="size-3" />
          {'Locked'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange('unlocked')}
        className={cl(
          'flex-1 md:flex-initial rounded-sm px-2 md:px-3 h-[36px] md:h-[26px] text-xs font-semibold transition-all',
          'active:scale-[0.98] whitespace-nowrap',
          SELECTOR_BAR_STYLES.buttonBase,
          activeVariant === 'unlocked' ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
        )}
      >
        <span className="inline-flex items-center gap-1">
          <IconLockOpen className="size-3" />
          {'Unlocked'}
        </span>
      </button>
    </div>
  )
}
