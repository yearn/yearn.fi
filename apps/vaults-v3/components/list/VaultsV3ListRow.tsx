import Link from '@components/Link'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import { cl, isZero, toAddress, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultForwardAPY } from '@vaults-v3/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@vaults-v3/components/table/VaultHistoricalAPY'
import { VaultRiskScoreTag } from '@vaults-v3/components/table/VaultRiskScoreTag'
import { VaultStakedAmount } from '@vaults-v3/components/table/VaultStakedAmount'
import { getExplorerAddressUrl } from '@vaults-v3/utils/explorer'
import { useAvailableToDeposit } from '@vaults-v3/utils/useAvailableToDeposit'
import type { ReactElement } from 'react'
import { VaultChainTag } from '../VaultChainTag'

export function VaultsV3ListRow({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const availableToDeposit = useAvailableToDeposit(currentVault)

  return (
    <Link href={`/v3/${currentVault.chainID}/${toAddress(currentVault.address)}`}>
      <div
        className={cl(
          'grid w-full grid-cols-1 md:grid-cols-12 rounded-3xl',
          'p-6 pt-2 md:pr-10',
          'cursor-pointer relative group'
        )}
      >
        <div
          className={cl(
            'absolute inset-0 rounded-3xl',
            'opacity-20 transition-opacity group-hover:opacity-100 pointer-events-none',
            'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
          )}
        />

        <div className={cl('col-span-4 z-10', 'flex flex-row items-center justify-between')}>
          <div className={'flex flex-row gap-6 overflow-hidden pr-10'}>
            <div className={'mt-2.5 size-8 min-h-8 min-w-8 rounded-full md:flex'}>
              {/* TODO:add env for asset address */}
              <ImageWithFallback
                src={`https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/${currentVault.chainID}/${currentVault.token.address.toLowerCase()}/logo-32.png`}
                // src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/token/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
                alt={''}
                width={32}
                height={32}
              />
            </div>
            <div className={'truncate'}>
              <strong
                title={currentVault.name}
                className={'block truncate font-black text-neutral-800 md:-mb-0.5 md:text-lg'}
              >
                {currentVault.name}
              </strong>
              <p className={'mb-0 block text-sm text-neutral-800/60 md:mb-2'}>{currentVault.token.name}</p>
              <div className={'hidden flex-row items-center md:flex'}>
                <VaultChainTag chainID={currentVault.chainID} />
                <button
                  type={'button'}
                  onClick={(event): void => {
                    event.stopPropagation()
                    window.open(
                      getExplorerAddressUrl(currentVault.chainID, currentVault.address),
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }}
                  className={'text-neutral-900/50 transition-opacity hover:text-neutral-900 cursor-pointer'}
                >
                  <div className={'px-2'}>
                    <IconLinkOut className={'inline-block size-4'} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={cl('col-span-8 z-10', 'grid grid-cols-2 md:grid-cols-12 gap-4', 'mt-4 md:mt-0')}>
          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APY'}</p>
            <VaultForwardAPY currentVault={currentVault} />
          </div>

          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Historical APY'}</p>
            <VaultHistoricalAPY currentVault={currentVault} />
          </div>

          <VaultRiskScoreTag riskLevel={currentVault.info.riskLevel} />

          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Available'}</p>
            <p
              className={`yearn--table-data-section-item-value ${isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'}`}
            >
              <RenderAmount
                value={Number(toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized)}
                symbol={currentVault.token.symbol}
                decimals={currentVault.token.decimals}
                shouldFormatDust
                options={{
                  shouldDisplaySymbol: false,
                  maximumFractionDigits:
                    Number(toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized) > 1000 ? 2 : 4
                }}
              />
            </p>
          </div>

          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Deposited'}</p>
            <VaultStakedAmount currentVault={currentVault} />
          </div>

          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'TVL'}</p>
            <div className={'flex flex-col pt-0 text-right'}>
              <p className={'yearn--table-data-section-item-value'}>
                <RenderAmount
                  value={Number(toNormalizedBN(currentVault.tvl.totalAssets, currentVault.token.decimals).normalized)}
                  symbol={''}
                  decimals={6}
                  shouldFormatDust
                  options={{
                    shouldCompactValue: true,
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2
                  }}
                />
              </p>
              <small className={'text-xs text-neutral-900/40'}>
                <RenderAmount
                  value={currentVault.tvl?.tvl}
                  symbol={'USD'}
                  decimals={0}
                  options={{
                    shouldCompactValue: true,
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 0
                  }}
                />
              </small>
            </div>
          </div>
        </div>

        <div className={'mt-4 flex flex-row items-center border-t border-neutral-900/20 pt-4 md:hidden'}>
          <VaultChainTag chainID={currentVault.chainID} />
          <button
            type={'button'}
            onClick={(event): void => {
              event.stopPropagation()
              window.open(
                getExplorerAddressUrl(currentVault.chainID, currentVault.address),
                '_blank',
                'noopener,noreferrer'
              )
            }}
            className={'text-neutral-900/50 transition-opacity hover:text-neutral-900 cursor-pointer'}
          >
            <div className={'px-2'}>
              <IconLinkOut className={'inline-block size-4'} />
            </div>
          </button>
        </div>
      </div>
    </Link>
  )
}
