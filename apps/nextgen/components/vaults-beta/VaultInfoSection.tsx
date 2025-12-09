import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi/utils'
import type { ReactElement } from 'react'

export function VaultInfoSection({
  currentVault,
  yDaemonBaseUri
}: {
  currentVault: TYDaemonVault
  yDaemonBaseUri: string
}): ReactElement {
  const blockExplorer =
    getNetwork(currentVault.chainID).blockExplorers?.etherscan?.url ||
    getNetwork(currentVault.chainID).blockExplorers?.default.url

  return (
    <div className={'grid w-full grid-cols-1 gap-10 p-4 md:p-8'}>
      <div className={'col-span-1 grid w-full gap-1'}>
        <div className={'flex flex-col items-center md:flex-row'}>
          <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Vault Contract Address'}</p>
          <a
            className={'font-number text-sm text-neutral-900 hover:underline'}
            href={`${blockExplorer}/address/${currentVault.address}`}
            target={'_blank'}
            rel={'noopener noreferrer'}
            suppressHydrationWarning
          >
            {currentVault.address}
          </a>
        </div>

        <div className={'flex flex-col items-center md:flex-row'}>
          <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Token Contract Address'}</p>
          <a
            href={`${blockExplorer}/address/${currentVault.token.address}`}
            target={'_blank'}
            rel={'noopener noreferrer'}
            className={'font-number text-sm text-neutral-900 hover:underline'}
            suppressHydrationWarning
          >
            {currentVault.token.address}
          </a>
        </div>

        {currentVault.staking.available ? (
          <div className={'flex flex-col items-center md:flex-row'}>
            <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Staking Contract Address'}</p>
            <a
              href={`${blockExplorer}/address/${currentVault.staking.address}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={'font-number text-sm text-neutral-900 hover:underline'}
              suppressHydrationWarning
            >
              {currentVault.staking.address}
            </a>
          </div>
        ) : null}

        {(currentVault.info?.sourceURL || '')?.includes('curve.finance') ? (
          <div className={'flex flex-col items-center md:flex-row'}>
            <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Curve deposit URI'}</p>
            <a
              href={currentVault.info.sourceURL}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={'font-number text-sm text-neutral-900 hover:underline'}
              suppressHydrationWarning
            >
              {currentVault.info.sourceURL}
            </a>
          </div>
        ) : null}

        {(currentVault.info?.sourceURL || '')?.includes('gamma') ? (
          <div className={'flex flex-col items-center md:flex-row'}>
            <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Gamma Pair'}</p>
            <a
              href={currentVault.info.sourceURL}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={'font-number whitespace-nowrap text-sm text-neutral-900 hover:underline'}
              suppressHydrationWarning
            >
              {currentVault.info.sourceURL}
            </a>
          </div>
        ) : null}

        <div className={'flex flex-col items-center md:flex-row'}>
          <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Price Per Share'}</p>
          <p className={'font-number text-sm text-neutral-900'} suppressHydrationWarning>
            {currentVault.apr.pricePerShare.today}
          </p>
        </div>

        <div className={'flex flex-col items-center md:flex-row'}>
          <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'yDaemon Vault Data'}</p>
          <a
            href={`${yDaemonBaseUri}/vaults/${currentVault.address}`}
            target={'_blank'}
            rel={'noopener noreferrer'}
            className={'text-sm text-neutral-900 hover:underline'}
            suppressHydrationWarning
          >
            {'View API Data'}
          </a>
        </div>
      </div>
    </div>
  )
}
