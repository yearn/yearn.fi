import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

export function NonYearnVaultAcknowledgement({
  onAcknowledge,
  disableBorderRadius = false
}: {
  onAcknowledge: () => void
  disableBorderRadius?: boolean
}): ReactElement {
  return (
    <div
      className={cl(
        'flex flex-col gap-4 border border-border border-l-4 border-l-orange-500 bg-surface p-6 text-sm text-text-primary dark:border-l-yellow-500',
        disableBorderRadius ? '' : 'rounded-lg'
      )}
      data-testid={'non-yearn-vault-acknowledgement'}
    >
      <p className={'text-base font-semibold'}>{'This is not a Yearn vault.'}</p>
      <p className={'text-text-secondary'}>
        {
          'This vault was deployed by a third party. Yearn has not reviewed it, its strategies or its manager. Its name is chosen by whoever deployed it. Check the contract address before depositing.'
        }
      </p>
      <button
        type={'button'}
        onClick={onAcknowledge}
        className={'yearn--button--nextgen w-full'}
        data-variant={'filled'}
      >
        {'I understand, continue'}
      </button>
    </div>
  )
}
