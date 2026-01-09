import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { Button } from '@lib/components/Button'
import { RenderAmount } from '@lib/components/RenderAmount'
import { TokenLogo } from '@lib/components/TokenLogo'
import { IconClose } from '@lib/icons/IconClose'
import { cl, formatPercent, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import { VaultRiskScoreTag } from '@vaults/components/table/VaultRiskScoreTag'
import { deriveListKind } from '@vaults/shared/utils/vaultListFacets'
import type { ReactElement } from 'react'
import { Fragment } from 'react'

type TVaultsCompareModalProps = {
  isOpen: boolean
  onClose: () => void
  vaults: TYDaemonVault[]
  onRemove: (vaultKey: string) => void
  onClear: () => void
}

const listKindLabels = {
  allocator: 'Allocator',
  strategy: 'Strategy',
  factory: 'Factory',
  legacy: 'Legacy'
}

const getVaultKey = (vault: TYDaemonVault): string => `${vault.chainID}_${toAddress(vault.address)}`

const formatFee = (value: number | undefined): string => {
  return formatPercent((value || 0) * 100, 0)
}

const MetricLabel = ({ label, sublabel }: { label: string; sublabel?: string }): ReactElement => (
  <div className={'text-xs font-semibold uppercase tracking-wide text-text-secondary'}>
    <span>{label}</span>
    {sublabel ? <span className={'mt-1 block text-[11px] text-text-secondary/70'}>{sublabel}</span> : null}
  </div>
)

const MetricValue = ({ children, className }: { children: ReactElement; className?: string }): ReactElement => (
  <div
    className={cl('rounded-xl border border-border bg-surface-secondary/40 p-3 text-sm text-text-primary', className)}
  >
    {children}
  </div>
)

const renderPercentValue = (value: number | undefined): ReactElement => {
  if (value === undefined || Number.isNaN(value)) {
    return <span className={'text-text-secondary'}>{'—'}</span>
  }
  return <RenderAmount value={value} symbol={'percent'} decimals={6} />
}

export function VaultsCompareModal({
  isOpen,
  onClose,
  vaults,
  onRemove,
  onClear
}: TVaultsCompareModalProps): ReactElement {
  const columnsCount = Math.max(vaults.length, 1)
  const gridTemplateColumns = `minmax(160px, 220px) repeat(${columnsCount}, minmax(180px, 1fr))`
  const hasVaults = vaults.length > 0

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

        <div className={'fixed inset-0 overflow-y-auto'}>
          <div className={'flex min-h-full items-center justify-center p-4'}>
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
                className={
                  'w-full max-w-6xl rounded-3xl border border-border bg-surface p-6 text-text-primary shadow-lg'
                }
              >
                <div className={'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'}>
                  <div>
                    <Dialog.Title className={'text-xl font-semibold text-text-primary'}>
                      {'Compare vaults'}
                    </Dialog.Title>
                    <p className={'mt-1 text-sm text-text-secondary'}>{'Review key metrics side-by-side.'}</p>
                  </div>
                  <div className={'flex items-center gap-2'}>
                    {hasVaults ? (
                      <Button
                        variant={'outlined'}
                        onClick={onClear}
                        classNameOverride={'yearn--button--nextgen yearn--button-smaller'}
                      >
                        {'Clear selection'}
                      </Button>
                    ) : null}
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
                ) : (
                  <div className={'mt-6 overflow-x-auto'}>
                    <div className={'min-w-[640px]'}>
                      <div className={'grid gap-x-4 gap-y-4'} style={{ gridTemplateColumns }}>
                        <div />
                        {vaults.map((vault) => {
                          const network = getNetwork(vault.chainID)
                          const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${vault.chainID}/logo-32.png`
                          const vaultKey = getVaultKey(vault)
                          return (
                            <div
                              key={`header-${vaultKey}`}
                              className={
                                'flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-secondary/40 p-3'
                              }
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
                                      <span>{vault.token.symbol}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <button
                                type={'button'}
                                onClick={(): void => onRemove(vaultKey)}
                                className={cl(
                                  'inline-flex size-7 items-center justify-center rounded-full border border-transparent text-text-secondary',
                                  'hover:border-border hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                                )}
                                aria-label={`Remove ${vault.name} from comparison`}
                              >
                                <IconClose className={'size-3'} />
                              </button>
                            </div>
                          )
                        })}

                        <MetricLabel label={'Est. APY'} sublabel={'Forward net APR'} />
                        {vaults.map((vault) => (
                          <MetricValue key={`apy-${getVaultKey(vault)}`}>
                            <div className={'flex items-center gap-2'}>
                              {renderPercentValue(vault.apr?.forwardAPR?.netAPR)}
                            </div>
                          </MetricValue>
                        ))}

                        <MetricLabel label={'TVL'} sublabel={'Total value locked'} />
                        {vaults.map((vault) => (
                          <MetricValue key={`tvl-${getVaultKey(vault)}`}>
                            <RenderAmount
                              value={vault.tvl?.tvl}
                              symbol={'USD'}
                              decimals={0}
                              options={{
                                shouldCompactValue: true,
                                maximumFractionDigits: 2,
                                minimumFractionDigits: 0
                              }}
                            />
                          </MetricValue>
                        ))}

                        <MetricLabel label={'Fees'} sublabel={'Management / Performance / Withdrawal'} />
                        {vaults.map((vault) => (
                          <MetricValue key={`fees-${getVaultKey(vault)}`} className={'text-xs'}>
                            <div className={'grid grid-cols-2 gap-x-2 gap-y-1'}>
                              <span className={'text-text-secondary'}>{'Management'}</span>
                              <span className={'text-right font-number text-text-primary'}>
                                {formatFee(vault.apr?.fees?.management)}
                              </span>
                              <span className={'text-text-secondary'}>{'Performance'}</span>
                              <span className={'text-right font-number text-text-primary'}>
                                {formatFee(vault.apr?.fees?.performance)}
                              </span>
                              <span className={'text-text-secondary'}>{'Withdrawal'}</span>
                              <span className={'text-right font-number text-text-primary'}>
                                {formatFee(vault.apr?.fees?.withdrawal)}
                              </span>
                            </div>
                          </MetricValue>
                        ))}

                        <MetricLabel label={'Risk'} sublabel={'Security score'} />
                        {vaults.map((vault) => {
                          const riskLevel = vault.info?.riskLevel ?? -1
                          const normalizedRisk = riskLevel < 0 ? 0 : riskLevel > 5 ? 5 : riskLevel
                          return (
                            <MetricValue key={`risk-${getVaultKey(vault)}`}>
                              <div className={'flex items-center gap-3'}>
                                <VaultRiskScoreTag riskLevel={riskLevel} variant={'inline'} />
                                <span className={'text-xs text-text-secondary'}>{`Level ${normalizedRisk} / 5`}</span>
                              </div>
                            </MetricValue>
                          )
                        })}

                        <MetricLabel label={'Strategy type'} sublabel={'Vault structure'} />
                        {vaults.map((vault) => {
                          const listKind = deriveListKind(vault)
                          const label = listKindLabels[listKind]
                          return (
                            <MetricValue key={`strategy-${getVaultKey(vault)}`}>
                              <div className={'flex flex-col gap-1'}>
                                <span className={'text-sm font-semibold text-text-primary'}>{label}</span>
                                <span className={'text-xs text-text-secondary'}>{vault.kind}</span>
                              </div>
                            </MetricValue>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className={'mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end'}>
                  <Button
                    variant={'outlined'}
                    onClick={onClose}
                    classNameOverride={'yearn--button--nextgen yearn--button-smaller'}
                  >
                    {'Back to list'}
                  </Button>
                </div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
