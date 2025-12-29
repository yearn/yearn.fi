import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { getVaultTypeEmoji, getVaultTypeLabel } from './vaultTypeCopy'

type TVaultVersionToggleProps = {
  className?: string
}

export function VaultVersionToggle({ className }: TVaultVersionToggleProps): ReactElement {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isFactoryActive = searchParams.get('type') === 'factory'
  const isV3Active = !isFactoryActive
  const allocatorLabel = getVaultTypeLabel('v3')
  const allocatorEmoji = getVaultTypeEmoji('v3')
  const factoryLabel = getVaultTypeLabel('factory')
  const factoryEmoji = getVaultTypeEmoji('factory')

  return (
    <div
      className={cl(
        'flex h-10 shrink-0 items-stretch overflow-hidden rounded-xl border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border',
        className
      )}
    >
      <button
        type={'button'}
        className={cl(
          'flex h-full items-center gap-1 px-2 font-medium transition-colors',
          'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary'
        )}
        data-active={isV3Active}
        onClick={(): void => void navigate('/vaults')}
        aria-pressed={isV3Active}
      >
        <span
          aria-hidden={true}
          className={'size-5 overflow-hidden rounded-full bg-surface/80 flex items-center justify-center'}
        >
          {allocatorEmoji}
        </span>
        <span className={'whitespace-nowrap'}>{allocatorLabel}</span>
      </button>
      <button
        type={'button'}
        className={cl(
          'flex h-full items-center gap-2 px-3 font-medium transition-colors',
          'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary'
        )}
        data-active={isFactoryActive}
        onClick={(): void => void navigate('/vaults?type=factory')}
        aria-pressed={isFactoryActive}
      >
        <span
          aria-hidden={true}
          className={'size-5 overflow-hidden rounded-full bg-surface/80 flex items-center justify-center'}
        >
          {factoryEmoji}
        </span>
        <span className={'whitespace-nowrap'}>{factoryLabel}</span>
      </button>
    </div>
  )
}
