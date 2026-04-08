import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import {
  getVaultChainID,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getVaultPrimaryLogoSrc } from '@pages/vaults/utils/vaultLogo'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useYearn } from '@shared/contexts/useYearn'
import { IconClose } from '@shared/icons/IconClose'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { cl, formatUSD, SUPPORTED_NETWORKS, toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { Fragment, useMemo } from 'react'
import { Link } from 'react-router'
import { usePortfolioBreakdown } from '../hooks/usePortfolioBreakdown'
import type { TPortfolioBreakdownVault } from '../types/api'

type TPortfolioHistoryBreakdownModalProps = {
  date: string | null
  isOpen: boolean
  onClose: () => void
}

type TEnrichedBreakdownVault = {
  chainId: number
  chainName: string
  vaultAddress: string
  vaultHref: string
  displayName: string
  displaySymbol: string
  logoSrc: string
  altLogoSrc: string | undefined
  usdValue: number
  status: TPortfolioBreakdownVault['status']
}

function formatBreakdownDate(date: string | null): string {
  if (!date) {
    return 'Selected date'
  }

  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

function getStatusLabel(status: TPortfolioBreakdownVault['status']): string | null {
  switch (status) {
    case 'missing_metadata':
      return 'Missing metadata'
    case 'missing_pps':
      return 'Missing PPS'
    case 'missing_price':
      return 'Missing price'
    default:
      return null
  }
}

function getChainName(chainId: number): string {
  return SUPPORTED_NETWORKS.find((network) => network.id === chainId)?.name ?? `Chain ${chainId}`
}

export function PortfolioHistoryBreakdownModal({
  date,
  isOpen,
  onClose
}: TPortfolioHistoryBreakdownModalProps): ReactElement {
  const { allVaults } = useYearn()
  const { data, isLoading, error } = usePortfolioBreakdown(date, isOpen)

  const enrichedVaults = useMemo<TEnrichedBreakdownVault[]>(() => {
    return (data?.vaults ?? []).map((vault): TEnrichedBreakdownVault => {
      const normalizedVaultAddress = toAddress(vault.vaultAddress)
      const currentVault = allVaults[normalizedVaultAddress] as TKongVaultInput | undefined
      const fallbackTokenAddress = vault.metadata?.tokenAddress
      const fallbackLogoSrc = fallbackTokenAddress
        ? `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainId}/${toAddress(fallbackTokenAddress).toLowerCase()}/logo-128.png`
        : `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainId}/${normalizedVaultAddress.toLowerCase()}/logo-128.png`

      return {
        chainId: vault.chainId,
        chainName: currentVault ? getChainName(getVaultChainID(currentVault)) : getChainName(vault.chainId),
        vaultAddress: normalizedVaultAddress,
        vaultHref: `/vaults/${vault.chainId}/${normalizedVaultAddress}`,
        displayName: currentVault ? getVaultName(currentVault) : vault.metadata?.symbol || normalizedVaultAddress,
        displaySymbol: currentVault ? getVaultSymbol(currentVault) : vault.metadata?.symbol || 'Unknown',
        logoSrc: currentVault ? getVaultPrimaryLogoSrc(currentVault) : fallbackLogoSrc,
        altLogoSrc: currentVault
          ? `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${getVaultChainID(currentVault)}/${toAddress(getVaultToken(currentVault).address).toLowerCase()}/logo-128.png`
          : undefined,
        usdValue: vault.usdValue ?? 0,
        status: vault.status
      }
    })
  }, [allVaults, data?.vaults])

  const title = `Vault breakdown on ${formatBreakdownDate(date)}`
  const issueCount =
    (data?.issues.missingMetadata.length ?? 0) +
    (data?.issues.missingPps.length ?? 0) +
    (data?.issues.missingPrice.length ?? 0)

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-[110]'} onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter={'duration-200 ease-out'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'duration-150 ease-in'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-black/45'} />
        </TransitionChild>

        <div className={'fixed inset-0 overflow-y-auto'}>
          <div className={'flex min-h-full items-center justify-center p-3 sm:p-6'}>
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
                  'w-full max-w-3xl rounded-3xl border border-border bg-surface p-5 text-text-primary shadow-lg sm:p-6'
                }
              >
                <div className={'flex items-start justify-between gap-4'}>
                  <div className={'min-w-0'}>
                    <Dialog.Title className={'text-lg font-semibold text-text-primary sm:text-xl'}>
                      {title}
                    </Dialog.Title>
                    {data ? (
                      <p className={'mt-1 text-sm text-text-secondary'}>
                        {`${data.summary.vaultsWithShares} vault${data.summary.vaultsWithShares === 1 ? '' : 's'} • ${formatUSD(data.summary.totalUsdValue, 2, 2)}`}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type={'button'}
                    onClick={onClose}
                    className={cl(
                      'inline-flex size-8 items-center justify-center rounded-full border border-transparent text-text-secondary',
                      'hover:border-border hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-300'
                    )}
                    aria-label={'Close holdings breakdown'}
                  >
                    <IconClose className={'size-4'} />
                  </button>
                </div>

                <div className={'mt-4'}>
                  {isLoading ? (
                    <div className={'flex min-h-[240px] items-center justify-center'}>
                      <IconSpinner className={'size-7 animate-spin text-text-secondary'} />
                    </div>
                  ) : error ? (
                    <div className={'flex min-h-[240px] items-center justify-center'}>
                      <p className={'text-sm text-text-secondary'}>{'Unable to load vault breakdown right now.'}</p>
                    </div>
                  ) : data && enrichedVaults.length > 0 ? (
                    <div className={'flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1'}>
                      {issueCount > 0 ? (
                        <div
                          className={
                            'rounded-2xl border border-border bg-surface-secondary px-4 py-3 text-sm text-text-secondary'
                          }
                        >
                          {`${issueCount} valuation issue${issueCount === 1 ? '' : 's'} on this date. Rows with missing pricing inputs remain in the total list below with a status badge.`}
                        </div>
                      ) : null}
                      {enrichedVaults.map((vault) => {
                        const statusLabel = getStatusLabel(vault.status)
                        return (
                          <div
                            key={`${vault.chainId}:${vault.vaultAddress}`}
                            className={
                              'flex items-center gap-3 rounded-2xl border border-border bg-surface-secondary px-4 py-3'
                            }
                          >
                            <TokenLogo
                              src={vault.logoSrc}
                              altSrc={vault.altLogoSrc}
                              tokenSymbol={vault.displaySymbol}
                              tokenName={vault.displayName}
                              chainId={vault.chainId}
                              width={40}
                              height={40}
                            />
                            <div className={'min-w-0 flex-1'}>
                              <Link
                                to={vault.vaultHref}
                                className={
                                  'block truncate text-sm font-medium text-text-primary transition-colors hover:text-accent-500 sm:text-base'
                                }
                                onClick={onClose}
                              >
                                {vault.displayName}
                              </Link>
                              <div
                                className={
                                  'mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary'
                                }
                              >
                                <span>{vault.displaySymbol}</span>
                                <span>{'•'}</span>
                                <span>{vault.chainName}</span>
                                {statusLabel ? (
                                  <span
                                    className={
                                      'rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-secondary'
                                    }
                                  >
                                    {statusLabel}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className={'text-right'}>
                              <p className={'text-sm font-semibold text-text-primary sm:text-base'}>
                                {formatUSD(vault.usdValue, 2, 2)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className={'flex min-h-[240px] items-center justify-center'}>
                      <p className={'max-w-md text-center text-sm text-text-secondary'}>
                        {data?.message || 'No vault breakdown available for this date.'}
                      </p>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
