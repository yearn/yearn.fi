import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useSearchParams } from 'react-router'
import { getVaultTypeEmoji, getVaultTypeLabel } from './vaultTypeCopy'
import { getSupportedChainsForVaultType, normalizeVaultTypeParam, sanitizeChainsParam } from './vaultTypeUtils'

type TVaultVersionToggleProps = {
  className?: string
  stretch?: boolean
}

export function VaultVersionToggle({ className, stretch }: TVaultVersionToggleProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()
  const normalizedType = normalizeVaultTypeParam(searchParams.get('type'))
  const isAllActive = normalizedType === 'all'
  const isLPActive = normalizedType === 'factory'
  const isAllocatorActive = !isLPActive && !isAllActive
  const allLabel = getVaultTypeLabel('all')
  const allEmoji = getVaultTypeEmoji('all')
  const allocatorLabel = getVaultTypeLabel('v3')
  const allocatorEmoji = getVaultTypeEmoji('v3')
  const lpLabel = getVaultTypeLabel('factory')
  const lpEmoji = getVaultTypeEmoji('factory')

  const goToAll = (): void => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('type', 'all')
    nextParams.delete('types')
    sanitizeChainsParam(nextParams, getSupportedChainsForVaultType('all'))
    setSearchParams(nextParams, { replace: true })
  }

  const goToAllocator = (): void => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('type')
    nextParams.delete('types')
    sanitizeChainsParam(nextParams, getSupportedChainsForVaultType('v3'))
    setSearchParams(nextParams, { replace: true })
  }

  const goToLP = (): void => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('type', 'lp')
    nextParams.delete('types')
    sanitizeChainsParam(nextParams, getSupportedChainsForVaultType('factory'))
    setSearchParams(nextParams, { replace: true })
  }

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
          'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
          'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary',
          stretch ? 'flex-1' : ''
        )}
        data-active={isAllActive}
        onClick={goToAll}
        aria-pressed={isAllActive}
      >
        <span
          aria-hidden={true}
          className={'size-5 overflow-hidden rounded-full bg-surface/80 flex items-center justify-center'}
        >
          {allEmoji}
        </span>
        <span className={'whitespace-nowrap'}>{allLabel}</span>
      </button>
      <button
        type={'button'}
        className={cl(
          'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
          'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary',
          stretch ? 'flex-1' : ''
        )}
        data-active={isAllocatorActive}
        onClick={goToAllocator}
        aria-pressed={isAllocatorActive}
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
          'flex h-full items-center justify-center gap-2 px-3 font-medium transition-colors',
          'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary',
          stretch ? 'flex-1' : ''
        )}
        data-active={isLPActive}
        onClick={goToLP}
        aria-pressed={isLPActive}
      >
        <span
          aria-hidden={true}
          className={'size-5 overflow-hidden rounded-full bg-surface/80 flex items-center justify-center'}
        >
          {lpEmoji}
        </span>
        <span className={'whitespace-nowrap'}>{lpLabel}</span>
      </button>
    </div>
  )
}
