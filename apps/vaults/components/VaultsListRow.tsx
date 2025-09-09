import Link from '@components/Link'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import { cl, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi/utils'
import { VaultChainTag } from '@vaults-v3/components/VaultChainTag'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { VaultForwardAPY, VaultRiskScoreTag } from './table'

type TVaultsListRowProps = {
  currentVault: TYDaemonVault
  isV2: boolean
  index?: number
}

export const VaultsListRow: FC<TVaultsListRowProps> = ({ currentVault, isV2, index = 0 }) => {
  const navigate = useNavigate()

  // TODO: Update router usage to use navigate, params, and location
  const href = isV2
    ? `/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`
    : `/v3/${currentVault.chainID}/${toAddress(currentVault.address)}`

  const handleRowClick = (): void => {
    navigate(href)
  }

  return (
    <div
      key={`${currentVault.address}-${currentVault.chainID}`}
      onClick={handleRowClick}
      className={cl(
        'grid w-full grid-cols-1 md:grid-cols-12',
        'px-4 py-3 md:px-4 md:py-0',
        'min-h-[200px] md:min-h-0',
        'cursor-pointer relative group'
      )}
    >
      <div
        className={cl('absolute inset-0 rounded-[12px]', index % 2 === 0 ? 'bg-neutral-900/3' : 'bg-neutral-900/4')}
      />
      <div
        className={cl(
          'absolute inset-0 rounded-[12px]',
          'opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none',
          'bg-neutral-900/10'
        )}
      />

      <div className={cl('col-span-4 z-10', 'flex flex-row items-center justify-between')}>
        <div className={'flex w-full flex-row items-center gap-3'}>
          <div className={'relative flex size-8 min-h-8 min-w-8 items-center justify-center rounded-full'}>
            <ImageWithFallback
              src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/token/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
              alt={''}
              width={24}
              height={24}
            />
          </div>
          <div className={'flex flex-col gap-1.5'}>
            <div className={'flex flex-row items-center'}>
              <p title={currentVault.name} className={'md:text-md block max-w-[280px] truncate text-neutral-800'}>
                {currentVault.name.replace(/(Yearn |v2|v3)/gi, '')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={cl('col-span-8 z-10', 'grid grid-cols-2 md:grid-cols-12 gap-4', 'mt-4 md:mt-0')}>
        <div className={'flex-column col-span-3 flex items-center justify-end'} datatype={'number'}>
          <p className={'inline w-full text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APY'}</p>
          <VaultForwardAPY currentVault={currentVault} />
        </div>

        <div className={'col-span-3'}>
          <VaultRiskScoreTag riskLevel={currentVault.info.riskLevel} />
        </div>

        <div className={'flex-column col-span-3 flex items-center justify-end'} datatype={'number'}>
          <p className={'inline w-full text-start text-xs text-neutral-800/60 md:hidden'}>{'Vault Type'}</p>
          <div className={'flex w-full flex-row items-center justify-end gap-1'}>
            <VaultChainTag chainID={currentVault.chainID} backgroundOpacity={0.5} />
            <p className={'block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-800/60'}>
              {isV2 ? 'V2' : 'V3'}
            </p>
          </div>
        </div>

        <div className={'yearn--table-data-section-item col-span-3 flex-row md:flex-col'} datatype={'number'}>
          <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'TVL'}</p>
          <div className={'flex flex-col pt-0 text-right'}>
            <p className={'yearn--table-data-section-item-value'}>
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
            </p>
          </div>
        </div>
      </div>

      <div className={'mt-4 flex flex-row items-center gap-1 border-t border-neutral-900/20 pt-4 md:hidden'}>
        <VaultChainTag chainID={currentVault.chainID} />
        <Link
          href={`${getNetwork(currentVault.chainID)?.defaultBlockExplorer}/address/${currentVault.address}`}
          onClick={(event): void => event.stopPropagation()}
          className={'text-neutral-900/50 transition-opacity hover:text-neutral-900'}
          target={'_blank'}
          rel={'noopener noreferrer'}
        >
          <IconLinkOut className={' size-4'} />
        </Link>
      </div>
    </div>
  )
}
