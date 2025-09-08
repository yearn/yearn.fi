import { IconLinkOut } from '@lib/icons/IconLinkOut'
import { IconSpinner } from '@lib/icons/IconSpinner'
import { formatAmount, formatUSD, toBigInt, toNormalizedValue } from '@lib/utils'
import { formatDate } from '@lib/utils/format.time'
import type {
  TYDaemonVault,
  TYDaemonVaultHarvest,
  TYDaemonVaultHarvests
} from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import { truncateHexTx } from '@vaults-v2/utils'
import type { ReactElement } from 'react'

function HarvestListHead(): ReactElement {
  return (
    <div className={'grid grid-cols-12 border-b border-neutral-200 px-10 pb-2'}>
      <div className={'col-span-3'} datatype={'number'}>
        <p className={'yearn--table-head-label'}>{'Date'}</p>
      </div>

      <div className={'col-span-3'} datatype={'number'}>
        <p className={'yearn--table-head-label'}>{'Gain'}</p>
      </div>

      <div className={'col-span-2'} datatype={'number'}>
        <p className={'yearn--table-head-label'}>{'Value'}</p>
      </div>

      <div className={'col-span-4'} datatype={'number'}>
        <p className={'yearn--table-head-label md:text-right'}>{'Transaction'}</p>
      </div>
    </div>
  )
}

function HarvestListRow({
  harvest,
  currentVault
}: {
  harvest: TYDaemonVaultHarvest
  currentVault: TYDaemonVault
}): ReactElement {
  const blockExplorer =
    getNetwork(currentVault.chainID).blockExplorers?.etherscan?.url ||
    getNetwork(currentVault.chainID).blockExplorers?.default.url

  return (
    <div className={'grid grid-cols-1 border-b border-neutral-200 px-10 pb-4 md:grid-cols-12'}>
      <div className={'col-span-3'} datatype={'number'}>
        <p className={'yearn--table-data-section-item-label'}>{'Date'}</p>
        <p className={'yearn--table-data-section-item-value font-number'} style={{ lineHeight: '24px' }}>
          {formatDate(Number(harvest.timestamp) * 1000)}
        </p>
      </div>

      <div className={'col-span-3'} datatype={'number'}>
        <p className={'yearn--table-data-section-item-label'}>{'Gain'}</p>
        <div>
          <b className={'yearn--table-data-section-item-value font-number'}>
            {toBigInt(harvest.profit) - toBigInt(harvest.loss) > 0n ? '+' : '-'}
            &nbsp;
            {formatAmount(
              toNormalizedValue(toBigInt(harvest.profit) - toBigInt(harvest.loss), currentVault.token.decimals),
              6,
              currentVault.token.decimals
            )}
          </b>
        </div>
      </div>

      <div className={'col-span-2'} datatype={'number'}>
        <p className={'yearn--table-data-section-item-label'}>{'Value'}</p>
        <p className={'yearn--table-data-section-item-value font-number'}>
          {formatUSD(Number(harvest.profitValue) - Number(harvest.lossValue))}
        </p>
      </div>

      <div className={'col-span-4'}>
        <p className={'yearn--table-data-section-item-label'}>{'Hash'}</p>
        <a href={`${blockExplorer}/tx/${harvest.txHash}`} target={'_blank'} rel={'noreferrer'}>
          <div
            className={'font-number flex flex-row items-center space-x-2 text-neutral-900 md:justify-end'}
            style={{ lineHeight: '24px' }}
          >
            {truncateHexTx(harvest.txHash, 12)}
            <IconLinkOut className={'ml-2 size-4 md:ml-4'} />
          </div>
        </a>
      </div>
    </div>
  )
}

export function VaultDetailsHistorical({
  harvests,
  isLoading,
  currentVault
}: {
  harvests: TYDaemonVaultHarvests | undefined
  isLoading: boolean
  currentVault: TYDaemonVault
}): ReactElement {
  if (isLoading) {
    return (
      <div className={'mt-6 flex flex-row items-center justify-center pb-12 pt-6'}>
        <IconSpinner className={'h-6! w-6! text-neutral-400!'} />
      </div>
    )
  }

  if (!harvests || harvests.length === 0) {
    return (
      <div className={'mt-6 flex flex-row items-center justify-center pb-12 pt-6'}>
        <p className={'text-neutral-500'}>{'No harvests yet'}</p>
      </div>
    )
  }

  return (
    <div className={'col-span-12 flex w-full flex-col'}>
      <div className={'mt-6 grid w-full grid-cols-1 gap-4 pb-6'}>
        <HarvestListHead />
        {(harvests || [])?.map((harvest: TYDaemonVaultHarvest, index: number): ReactElement => {
          return (
            <HarvestListRow
              key={`${harvest.timestamp}_${harvest.vaultAddress}_${index}`}
              currentVault={currentVault}
              harvest={harvest}
            />
          )
        })}
      </div>
    </div>
  )
}
