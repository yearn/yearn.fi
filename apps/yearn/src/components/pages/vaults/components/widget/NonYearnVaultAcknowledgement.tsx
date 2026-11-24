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
      <p className={'text-base font-semibold'}>{'This vault is not endorsed by Yearn.'}</p>
      <p className={'text-text-secondary'}>
        {
          "It is not on Yearn's list of endorsed vaults. Anyone can deploy a vault and choose its name, so check the contract address and who manages it before depositing."
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
