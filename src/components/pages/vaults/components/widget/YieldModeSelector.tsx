import type { TYieldSplitterModeOption } from '@pages/vaults/domain/yieldSplitterModes'
import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement } from 'react'

type TProps = {
  modes: TYieldSplitterModeOption[]
  activeModeId: string
  onChange: (modeId: string) => void
}

export function YieldModeSelector({ modes, activeModeId, onChange }: TProps): ReactElement | null {
  if (modes.length <= 1) {
    return null
  }

  const activeMode = modes.find((mode) => mode.id === activeModeId) ?? modes[0]

  return (
    <div className={'flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3'}>
      <div className={'flex items-center justify-between gap-3'}>
        <div className={'flex flex-col gap-0.5'}>
          <span className={'text-sm font-semibold text-text-primary'}>{'How do you want to earn yield?'}</span>
          <span className={'text-xs text-text-secondary'}>
            {'Choose whether this vault compounds natively or routes yield into another asset.'}
          </span>
        </div>
      </div>
      <div className={cl('flex flex-wrap items-center gap-1', SELECTOR_BAR_STYLES.container)}>
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            title={mode.description}
            className={cl(
              'rounded-sm px-3 h-[34px] text-xs font-semibold transition-all active:scale-[0.98] whitespace-nowrap',
              SELECTOR_BAR_STYLES.buttonBase,
              activeModeId === mode.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      {activeMode?.description ? <p className={'text-xs text-text-secondary'}>{activeMode.description}</p> : null}
    </div>
  )
}
