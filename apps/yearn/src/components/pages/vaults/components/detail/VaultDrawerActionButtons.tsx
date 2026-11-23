import { WidgetActionType } from '@pages/vaults/types'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

const ACTION_LABELS: Record<WidgetActionType, string> = {
  [WidgetActionType.Deposit]: 'Deposit',
  [WidgetActionType.Withdraw]: 'Withdraw',
  [WidgetActionType.Migrate]: 'Migrate'
}

export function VaultDrawerActionButtons({
  actions,
  onSelect,
  isCompactHeader
}: {
  actions: WidgetActionType[]
  onSelect: (action: WidgetActionType) => void
  isCompactHeader: boolean
}): ReactElement {
  return (
    <div className={'flex w-full gap-3'}>
      {actions.map((action, index) => (
        <button
          key={action}
          type={'button'}
          onClick={() => onSelect(action)}
          className={cl(
            index === 0 ? 'yearn--button--nextgen flex-1' : 'yearn--button flex-1',
            index > 0 && isCompactHeader
              ? 'border-border! bg-surface! hover:border-border-hover! hover:bg-surface-tertiary!'
              : ''
          )}
          data-variant={index === 0 ? 'filled' : 'light'}
        >
          {ACTION_LABELS[action]}
        </button>
      ))}
    </div>
  )
}
