import Link from '@components/Link'
import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { SwipeableCompareCarousel } from '@pages/vaults/components/compare/SwipeableCompareCarousel'
import { VaultHistoricalAPY } from '@pages/vaults/components/table/VaultHistoricalAPY'
import { VaultRiskScoreTag } from '@pages/vaults/components/table/VaultRiskScoreTag'
import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import { useMediaQuery } from '@react-hookz/web'
import { TokenLogo } from '@shared/components/TokenLogo'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconClose } from '@shared/icons/IconClose'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { cl, formatApyDisplay, formatPercent, formatTvlDisplay, toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi'
import { Fragment, type ReactElement, type ReactNode, useEffect, useState } from 'react'

type TVaultsCompareModalProps = {
  isOpen: boolean
  onClose: () => void
  vaults: TYDaemonVault[]
  onRemove: (vaultKey: string) => void
}

type TVaultStrategyItem = NonNullable<TYDaemonVault['strategies']>[number]

const listKindLabels = {
  allocator: 'Allocator',
  strategy: 'Strategy',
  factory: 'Factory',
  legacy: 'Legacy'
}

function formatFee(value: number | undefined): string {
  return formatPercent((value ?? 0) * 100, 0)
}

function MetricLabel({
  label,
  sublabel,
  onMouseEnter
}: {
  label: string
  sublabel?: string
  onMouseEnter?: () => void
}): ReactElement {
  return (
    <div
      className={'border-b border-border py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary'}
      onMouseEnter={onMouseEnter}
    >
      <span>{label}</span>
      {sublabel ? <span className={'mt-1 block text-[11px] text-text-secondary/70'}>{sublabel}</span> : null}
    </div>
  )
}

function MetricValue({
  children,
  className,
  onMouseEnter
}: {
  children: ReactNode
  className?: string
  onMouseEnter?: () => void
}): ReactElement {
  return (
    <div
      className={cl('border-b border-border py-3 text-left text-sm text-text-primary', className)}
      onMouseEnter={onMouseEnter}
    >
      {children}
    </div>
  )
}

function renderPercentValue(value: number | null | undefined): ReactElement {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={'text-text-secondary'}>{'—'}</span>
  }
  return <span className={'font-semibold'}>{formatApyDisplay(value)}</span>
}

function hasAllocatedFunds(strategy: TVaultStrategyItem): boolean {
  const { debtRatio, totalDebt } = strategy.details ?? {}
  return Boolean(debtRatio && debtRatio > 0 && totalDebt && totalDebt !== '0')
}

function normalizeRiskLevel(riskLevel: number): number {
  return Math.min(Math.max(riskLevel, 0), 5)
}

function DesktopCompareGrid({
  vaults,
  onRemove
}: {
  vaults: TYDaemonVault[]
  onRemove: (vaultKey: string) => void
}): ReactElement {
  const columnsCount = Math.max(vaults.length, 1)
  const gridTemplateColumns = `minmax(160px, 220px) repeat(${columnsCount}, minmax(180px, 1fr))`
  const [activeColumn, setActiveColumn] = useState<number | null>(null)

  return (
    <div className={'mt-6 overflow-x-auto'}>
      <div className={'min-w-[640px]'}>
        <div
          className={'grid gap-x-4'}
          style={{ gridTemplateColumns }}
          onMouseLeave={(): void => setActiveColumn(null)}
        >
          <div className={'border-b border-border pb-4'} onMouseEnter={(): void => setActiveColumn(null)} />
          {vaults.map((vault, index) => {
            const network = getNetwork(vault.chainID)
            const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${vault.chainID}/logo-32.png`
            const vaultKey = getVaultKey(vault)
            const vaultHref = `/vaults/${vault.chainID}/${toAddress(vault.address)}`
            const isColumnActive = activeColumn === index
            return (
              <div
                key={`header-${vaultKey}`}
                className={'flex flex-col gap-2 border-b border-border pb-4'}
                onMouseEnter={(): void => setActiveColumn(index)}
              >
                <button
                  type={'button'}
                  onClick={(): void => onRemove(vaultKey)}
                  className={cl(
                    'inline-flex size-7 items-center justify-center self-end rounded-full border border-transparent text-text-secondary',
                    'transition-opacity',
                    isColumnActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                    'hover:border-border hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                  )}
                  aria-label={`Remove ${vault.name} from comparison`}
                  tabIndex={isColumnActive ? 0 : -1}
                >
                  <IconClose className={'size-3'} />
                </button>
                <Link
                  href={vaultHref}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  className={cl(
                    'flex w-full items-start justify-between gap-3 rounded-2xl px-2 py-1.5',
                    'transition-colors hover:bg-surface-secondary/60',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                  )}
                  aria-label={`Open ${vault.name} vault in a new tab`}
                  onFocus={(): void => setActiveColumn(index)}
                >
                  <div className={'min-w-0'}>
                    <div className={'flex items-center gap-3'}>
                      <TokenLogo
                        src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${vault.token.address.toLowerCase()}/logo-128.png`}
                        tokenSymbol={vault.token.symbol || ''}
                        width={28}
                        height={28}
                      />
                      <div className={'min-w-0'}>
                        <p className={'truncate text-sm font-semibold text-text-primary'}>{vault.name}</p>
                        <div className={'mt-1 flex items-center gap-2 text-xs text-text-secondary'}>
                          <TokenLogo src={chainLogoSrc} tokenSymbol={network.name} width={14} height={14} />
                          <span>{network.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <IconLinkOut className={'mt-1 size-4 flex-shrink-0 text-text-secondary'} />
                </Link>
              </div>
            )
          })}

          <MetricLabel
            label={'Est. APY'}
            sublabel={'Forward net APR'}
            onMouseEnter={(): void => setActiveColumn(null)}
          />
          {vaults.map((vault, index) => (
            <MetricValue key={`apy-${getVaultKey(vault)}`} onMouseEnter={(): void => setActiveColumn(index)}>
              <div className={'flex items-center gap-2'}>{renderPercentValue(vault.apr?.forwardAPR?.netAPR)}</div>
            </MetricValue>
          ))}

          <MetricLabel
            label={'30 Day APY'}
            sublabel={'Average realized APY'}
            onMouseEnter={(): void => setActiveColumn(null)}
          />
          {vaults.map((vault, index) => (
            <MetricValue key={`apy-30d-${getVaultKey(vault)}`} onMouseEnter={(): void => setActiveColumn(index)}>
              <VaultHistoricalAPY currentVault={vault} className={'items-start text-left md:text-left'} />
            </MetricValue>
          ))}

          <MetricLabel label={'TVL'} sublabel={'Total value locked'} onMouseEnter={(): void => setActiveColumn(null)} />
          {vaults.map((vault, index) => (
            <MetricValue key={`tvl-${getVaultKey(vault)}`} onMouseEnter={(): void => setActiveColumn(index)}>
              <span className={'font-semibold'}>{formatTvlDisplay(vault.tvl?.tvl ?? 0)}</span>
            </MetricValue>
          ))}

          <MetricLabel
            label={'Fees'}
            sublabel={'Management / Performance'}
            onMouseEnter={(): void => setActiveColumn(null)}
          />
          {vaults.map((vault, index) => (
            <MetricValue
              key={`fees-${getVaultKey(vault)}`}
              className={'text-xs'}
              onMouseEnter={(): void => setActiveColumn(index)}
            >
              <div className={'flex flex-col gap-1'}>
                <span>
                  <span className={'text-text-secondary'}>{'Management:'}</span>{' '}
                  <span className={'text-text-primary'}>{formatFee(vault.apr?.fees?.management)}</span>
                </span>
                <span>
                  <span className={'text-text-secondary'}>{'Performance:'}</span>{' '}
                  <span className={'text-text-primary'}>{formatFee(vault.apr?.fees?.performance)}</span>
                </span>
              </div>
            </MetricValue>
          ))}

          <MetricLabel label={'Risk'} sublabel={'Security score'} onMouseEnter={(): void => setActiveColumn(null)} />
          {vaults.map((vault, index) => {
            const riskLevel = vault.info?.riskLevel ?? -1
            const normalizedRisk = normalizeRiskLevel(riskLevel)
            return (
              <MetricValue key={`risk-${getVaultKey(vault)}`} onMouseEnter={(): void => setActiveColumn(index)}>
                <div className={'flex items-center gap-3'}>
                  <VaultRiskScoreTag riskLevel={riskLevel} variant={'inline'} />
                  <span className={'text-xs text-text-secondary'}>{`Level ${normalizedRisk} / 5`}</span>
                </div>
              </MetricValue>
            )
          })}

          <MetricLabel
            label={'Strategy type'}
            sublabel={'Vault structure'}
            onMouseEnter={(): void => setActiveColumn(null)}
          />
          {vaults.map((vault, index) => {
            const listKind = deriveListKind(vault)
            const label = listKindLabels[listKind]
            return (
              <MetricValue key={`strategy-${getVaultKey(vault)}`} onMouseEnter={(): void => setActiveColumn(index)}>
                <div className={'flex flex-col gap-1'}>
                  <span className={'text-sm font-semibold text-text-primary'}>{label}</span>
                  <span className={'text-xs text-text-secondary'}>{vault.kind}</span>
                </div>
              </MetricValue>
            )
          })}

          <MetricLabel
            label={'Strategies'}
            sublabel={'Underlying positions'}
            onMouseEnter={(): void => setActiveColumn(null)}
          />
          {vaults.map((vault, index) => {
            const strategies = (vault.strategies ?? [])
              .filter((strategy) => strategy.status !== 'not_active' && hasAllocatedFunds(strategy))
              .sort((left, right) => (right.details?.debtRatio ?? 0) - (left.details?.debtRatio ?? 0))
            return (
              <MetricValue
                key={`strategies-${getVaultKey(vault)}`}
                className={'text-xs'}
                onMouseEnter={(): void => setActiveColumn(index)}
              >
                {strategies.length === 0 ? (
                  <span className={'text-text-secondary'}>{'—'}</span>
                ) : (
                  <div className={'flex flex-col gap-2'}>
                    {strategies.map((strategy) => {
                      const debtRatio = strategy.details?.debtRatio
                      const allocation = debtRatio ? formatPercent(debtRatio / 100, 0) : null
                      return (
                        <div key={strategy.address} className={'flex items-start gap-2'}>
                          <span className={'text-text-primary'}>{strategy.name}</span>
                          {allocation ? <span className={'text-text-secondary'}>{allocation}</span> : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </MetricValue>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MobileCompareView({
  vaults,
  onRemove
}: {
  vaults: TYDaemonVault[]
  onRemove: (vaultKey: string) => void
}): ReactElement {
  return (
    <div className={'mt-6'}>
      <SwipeableCompareCarousel vaults={vaults} onRemove={onRemove} />
    </div>
  )
}

export function VaultsCompareModal({ isOpen, onClose, vaults, onRemove }: TVaultsCompareModalProps): ReactElement {
  const hasVaults = vaults.length > 0
  const isMobile =
    useMediaQuery('(max-width: 767px)', {
      initializeWithValue: false
    }) ?? false

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const root = document.documentElement
    const body = document.body
    const previousBodyOverflow = body.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight
    const previousRootOverflow = root.style.getPropertyValue('overflow')
    const previousRootOverflowPriority = root.style.getPropertyPriority('overflow')
    const previousRootPaddingRight = root.style.getPropertyValue('padding-right')
    const previousRootPaddingRightPriority = root.style.getPropertyPriority('padding-right')
    const scrollBarWidth = window.innerWidth - root.clientWidth

    root.style.setProperty('overflow', 'hidden', 'important')
    body.style.overflow = 'hidden'
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`
      root.style.setProperty('padding-right', `${scrollBarWidth}px`, 'important')
    }

    return () => {
      body.style.overflow = previousBodyOverflow
      body.style.paddingRight = previousBodyPaddingRight
      if (previousRootOverflow) {
        root.style.setProperty('overflow', previousRootOverflow, previousRootOverflowPriority)
      } else {
        root.style.removeProperty('overflow')
      }
      if (previousRootPaddingRight) {
        root.style.setProperty('padding-right', previousRootPaddingRight, previousRootPaddingRightPriority)
      } else {
        root.style.removeProperty('padding-right')
      }
    }
  }, [isOpen])

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-[70]'} onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter={'duration-200 ease-out'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'duration-150 ease-in'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-black/40'} />
        </TransitionChild>

        <div className={'fixed inset-0 overflow-y-auto overscroll-contain'}>
          <div className={cl('flex min-h-full items-center justify-center', isMobile ? 'p-2' : 'p-4')}>
            <TransitionChild
              as={Fragment}
              enter={'duration-200 ease-out'}
              enterFrom={'opacity-0 scale-95'}
              enterTo={'opacity-100 scale-100'}
              leave={'duration-150 ease-in'}
              leaveFrom={'opacity-100 scale-100'}
              leaveTo={'opacity-0 scale-95'}
            >
              <Dialog.Panel
                className={cl(
                  'w-full overflow-hidden rounded-3xl border border-border bg-surface text-text-primary shadow-lg',
                  isMobile ? 'max-w-md p-4' : 'max-w-6xl p-6'
                )}
              >
                <div className={'flex items-start justify-between gap-4'}>
                  <div>
                    <Dialog.Title className={'text-xl font-semibold text-text-primary'}>
                      {'Compare vaults'}
                    </Dialog.Title>
                    <p className={'mt-1 text-sm text-text-secondary'}>
                      {isMobile ? 'Swipe to compare vaults.' : 'Review key metrics side-by-side.'}
                    </p>
                  </div>
                  <div className={'flex items-center gap-2'}>
                    <button
                      type={'button'}
                      onClick={onClose}
                      className={cl(
                        'inline-flex size-9 items-center justify-center rounded-full border border-border text-text-secondary',
                        'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                      )}
                      aria-label={'Close comparison'}
                    >
                      <IconClose className={'size-4'} />
                    </button>
                  </div>
                </div>

                {!hasVaults ? (
                  <div className={'mt-8 rounded-2xl border border-border bg-surface-secondary/40 p-6 text-center'}>
                    <p className={'text-sm text-text-secondary'}>{'Select at least two vaults to compare.'}</p>
                  </div>
                ) : isMobile ? (
                  <MobileCompareView vaults={vaults} onRemove={onRemove} />
                ) : (
                  <DesktopCompareGrid vaults={vaults} onRemove={onRemove} />
                )}
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
