import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useSearchParams } from 'react-router'
import type { TVaultType } from './vaultTypeCopy'
import { getVaultTypeEmoji, getVaultTypeLabel } from './vaultTypeCopy'
import { getSupportedChainsForVaultType, normalizeVaultTypeParam, sanitizeChainsParam } from './vaultTypeUtils'

type TVaultVersionToggleProps = {
  className?: string
  stretch?: boolean
}

type TButtonConfig = {
  type: TVaultType
  typeParam: string | null
}

const BUTTON_CONFIGS: TButtonConfig[] = [
  { type: 'all', typeParam: 'all' },
  { type: 'v3', typeParam: null },
  { type: 'factory', typeParam: 'lp' }
]

export function VaultVersionToggle({ className, stretch }: TVaultVersionToggleProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()
  const normalizedType = normalizeVaultTypeParam(searchParams.get('type'))

  const handleClick = (config: TButtonConfig): void => {
    const nextParams = new URLSearchParams(searchParams)
    if (config.typeParam === null) {
      nextParams.delete('type')
    } else {
      nextParams.set('type', config.typeParam)
    }
    nextParams.delete('types')
    sanitizeChainsParam(nextParams, getSupportedChainsForVaultType(config.type))
    setSearchParams(nextParams, { replace: true })
  }

  const isActive = (type: TVaultType): boolean => {
    if (type === 'all') return normalizedType === 'all'
    if (type === 'factory') return normalizedType === 'factory'
    return normalizedType !== 'all' && normalizedType !== 'factory'
  }

  return (
    <div
      className={cl(
        'flex h-10 shrink-0 items-stretch overflow-hidden rounded-xl border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border',
        className
      )}
    >
      {BUTTON_CONFIGS.map((config) => {
        const active = isActive(config.type)
        return (
          <button
            key={config.type}
            type={'button'}
            className={cl(
              'flex h-full items-center justify-center gap-2 px-3 font-medium transition-colors',
              'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
              'data-[active=true]:bg-surface data-[active=true]:text-text-primary',
              stretch ? 'flex-1' : ''
            )}
            data-active={active}
            onClick={() => handleClick(config)}
            aria-pressed={active}
          >
            <span
              aria-hidden={true}
              className={'size-5 overflow-hidden rounded-full bg-surface/80 flex items-center justify-center'}
            >
              {getVaultTypeEmoji(config.type)}
            </span>
            <span className={'whitespace-nowrap'}>{getVaultTypeLabel(config.type)}</span>
          </button>
        )
      })}
    </div>
  )
}
