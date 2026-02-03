import { usePlausible } from '@hooks/usePlausible'
import { TOOLTIP_DELAY_MS } from '@pages/vaults/utils/vaultTagCopy'
import type { TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { getVaultTypeDescription, getVaultTypeLabel } from '@pages/vaults/utils/vaultTypeCopy'
import {
  getSupportedChainsForVaultType,
  normalizeVaultTypeParam,
  sanitizeChainsParam
} from '@pages/vaults/utils/vaultTypeUtils'
import { Tooltip } from '@shared/components/Tooltip'
import { cl } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { ReactElement } from 'react'
import { useSearchParams } from 'react-router'

type TVaultVersionToggleProps = {
  className?: string
  stretch?: boolean
  activeType?: TVaultType
  onTypeChange?: (type: TVaultType) => void
  isPending?: boolean
}

type TButtonConfig = {
  type: TVaultType
  typeParam: string
}

const BUTTON_CONFIGS: TButtonConfig[] = [
  { type: 'all', typeParam: 'all' },
  { type: 'v3', typeParam: 'single' },
  { type: 'factory', typeParam: 'lp' }
]

export function VaultVersionToggle({
  className,
  stretch,
  activeType,
  onTypeChange,
  isPending
}: TVaultVersionToggleProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()
  const trackEvent = usePlausible()
  const normalizedType = normalizeVaultTypeParam(searchParams.get('type'))
  const resolvedType = activeType ?? normalizedType

  function handleClick(config: TButtonConfig): void {
    trackEvent(PLAUSIBLE_EVENTS.FILTER_VAULT_TYPE, { props: { value: config.type } })
    if (onTypeChange) {
      onTypeChange(config.type)
      return
    }
    const nextParams = new URLSearchParams(searchParams)
    if (config.typeParam === 'all') {
      nextParams.delete('type')
    } else {
      nextParams.set('type', config.typeParam)
    }
    sanitizeChainsParam(nextParams, getSupportedChainsForVaultType(config.type))
    setSearchParams(nextParams, { replace: true })
  }

  function isActive(type: TVaultType): boolean {
    switch (type) {
      case 'all':
        return resolvedType === 'all'
      case 'factory':
        return resolvedType === 'factory'
      default:
        return resolvedType !== 'all' && resolvedType !== 'factory'
    }
  }

  return (
    <div
      aria-busy={isPending || undefined}
      className={cl(
        'flex h-10 shrink-0 items-stretch overflow-hidden rounded-lg border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border',
        className
      )}
    >
      {BUTTON_CONFIGS.map((config) => {
        const active = isActive(config.type)
        const description = getVaultTypeDescription(config.type)
        const button = (
          <button
            key={config.type}
            type={'button'}
            className={cl(
              'flex h-full items-center justify-center gap-1 px-4 font-medium transition-colors',
              'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
              'data-[active=true]:bg-surface data-[active=true]:text-text-primary data-[active=true]:font-semibold',
              stretch ? 'flex-1' : ''
            )}
            data-active={active}
            onClick={() => handleClick(config)}
            aria-pressed={active}
          >
            <span className={'whitespace-nowrap'}>{getVaultTypeLabel(config.type)}</span>
          </button>
        )

        if (!description) {
          return button
        }

        return (
          <Tooltip
            key={config.type}
            className={cl('h-full', stretch ? 'flex-1 w-full' : '')}
            openDelayMs={TOOLTIP_DELAY_MS}
            tooltip={
              <div
                className={
                  'max-w-[220px] rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-text-primary shadow-md'
                }
              >
                <div className={'flex items-center gap-1 font-semibold'}>
                  <span>{getVaultTypeLabel(config.type)}</span>
                </div>
                <p className={'text-text-secondary'}>{description}</p>
              </div>
            }
          >
            {button}
          </Tooltip>
        )
      })}
    </div>
  )
}
