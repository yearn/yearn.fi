import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useSearchParams } from 'react-router'
import { getVaultTypeEmoji, getVaultTypeLabel } from './vaultTypeCopy'

type TVaultVersionToggleProps = {
  className?: string
  showStrategies?: boolean
  stretch?: boolean
}

export function VaultVersionToggle({ className, showStrategies, stretch }: TVaultVersionToggleProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()
  const isFactoryActive = searchParams.get('type') === 'factory'
  const typesParam = searchParams.get('types')
  const activeTypes = typesParam ? typesParam.split('_').filter(Boolean) : []
  const isStrategiesTabVisible = Boolean(showStrategies)
  const isStrategiesActive = isStrategiesTabVisible && !isFactoryActive && activeTypes.includes('single')
  const isAllocatorActive = !isFactoryActive && !isStrategiesActive
  const allocatorLabel = getVaultTypeLabel('v3')
  const allocatorEmoji = getVaultTypeEmoji('v3')
  const factoryLabel = getVaultTypeLabel('factory')
  const factoryEmoji = getVaultTypeEmoji('factory')
  const strategiesLabel = 'v3 Strategies'
  const strategiesEmoji = '🧩'

  const goToAllocator = (): void => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('type')
    nextParams.delete('types')
    setSearchParams(nextParams, { replace: true })
  }

  const goToStrategies = (): void => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('type')
    nextParams.set('types', 'single')
    nextParams.set('showStrategies', '1')
    setSearchParams(nextParams, { replace: true })
  }

  const goToFactory = (): void => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('type', 'factory')
    nextParams.delete('types')
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
      {isStrategiesTabVisible ? (
        <button
          type={'button'}
          className={cl(
            'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
            'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
            'data-[active=true]:bg-surface data-[active=true]:text-text-primary',
            stretch ? 'flex-1' : ''
          )}
          data-active={isStrategiesActive}
          onClick={goToStrategies}
          aria-pressed={isStrategiesActive}
        >
          <span
            aria-hidden={true}
            className={'size-5 overflow-hidden rounded-full bg-surface/80 flex items-center justify-center'}
          >
            {strategiesEmoji}
          </span>
          <span className={'whitespace-nowrap'}>{strategiesLabel}</span>
        </button>
      ) : null}
      <button
        type={'button'}
        className={cl(
          'flex h-full items-center justify-center gap-2 px-3 font-medium transition-colors',
          'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
          'data-[active=true]:bg-surface data-[active=true]:text-text-primary',
          stretch ? 'flex-1' : ''
        )}
        data-active={isFactoryActive}
        onClick={goToFactory}
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
