import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { truncateHex } from '@shared/utils'
import { copyToClipboard } from '@shared/utils/helpers'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi/utils'
import type { ReactElement } from 'react'

function AddressLink({
  address,
  explorerUrl,
  label
}: {
  address: string
  explorerUrl: string
  label: string
}): ReactElement {
  return (
    <div className={'flex flex-col items-start md:flex-row md:items-center'}>
      <p className={'w-full text-sm text-text-secondary md:w-44'}>{label}</p>
      <div className={'flex items-center gap-1 md:flex-1 md:justify-end'}>
        <a
          href={`${explorerUrl}/address/${address}`}
          target={'_blank'}
          rel={'noopener noreferrer'}
          className={'flex items-center gap-1 md:text-sm text-text-primary transition-colors hover:text-text-secondary'}
          suppressHydrationWarning
        >
          {truncateHex(address, 4)}
          <IconLinkOut className={'size-3'} />
        </a>
        <button
          type={'button'}
          onClick={(): void => copyToClipboard(address)}
          className={'text-text-secondary transition-colors hover:text-text-primary'}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          <IconCopy className={'size-3'} />
        </button>
      </div>
    </div>
  )
}

export function VaultInfoSection({
  currentVault,
  inceptTime
}: {
  currentVault: TYDaemonVault
  inceptTime?: number | null
}): ReactElement {
  const blockExplorer =
    getNetwork(currentVault.chainID).blockExplorers?.etherscan?.url ||
    getNetwork(currentVault.chainID).blockExplorers?.default.url
  const sourceUrl = String(currentVault.info?.sourceURL || '').toLowerCase()
  const isVelodrome = currentVault.category?.toLowerCase() === 'velodrome' || sourceUrl.includes('velodrome.finance')
  const isAerodrome = currentVault.category?.toLowerCase() === 'aerodrome' || sourceUrl.includes('aerodrome.finance')
  const liquidityUrl = isVelodrome
    ? `https://velodrome.finance/liquidity?query=${currentVault.token.address}`
    : isAerodrome
      ? `https://aerodrome.finance/liquidity?query=${currentVault.token.address}`
      : ''
  const powergloveUrl = `https://powerglove.yearn.fi/vaults/${currentVault.chainID}/${currentVault.address}`
  const deployedLabel = (() => {
    if (typeof inceptTime !== 'number' || !Number.isFinite(inceptTime) || inceptTime <= 0) {
      return null
    }
    const ms = inceptTime > 1_000_000_000_000 ? inceptTime : inceptTime * 1000
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    return date.toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  })()

  return (
    <div className={'grid w-full grid-cols-1 gap-10 p-4 md:p-6 md:pt-0'}>
      <div className={'col-span-1 grid w-full gap-1'}>
        <AddressLink
          address={currentVault.address}
          explorerUrl={blockExplorer || ''}
          label={'Vault Contract Address'}
        />

        <AddressLink
          address={currentVault.token.address}
          explorerUrl={blockExplorer || ''}
          label={'Token Contract Address'}
        />

        {currentVault.staking.available ? (
          <AddressLink
            address={currentVault.staking.address}
            explorerUrl={blockExplorer || ''}
            label={'Staking Contract Address'}
          />
        ) : null}

        {(currentVault.info?.sourceURL || '')?.includes('curve.finance') ? (
          <div className={'flex flex-col items-start md:flex-row md:items-center'}>
            <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Curve deposit URI'}</p>
            <div className={'flex md:flex-1 md:justify-end'}>
              <a
                href={currentVault.info.sourceURL}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={'md:text-sm text-text-primary hover:underline'}
                suppressHydrationWarning
              >
                {currentVault.info.sourceURL}
              </a>
            </div>
          </div>
        ) : null}

        {(currentVault.info?.sourceURL || '')?.includes('gamma') ? (
          <div className={'flex flex-col items-start md:flex-row md:items-center'}>
            <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Gamma Pair'}</p>
            <div className={'flex md:flex-1 md:justify-end'}>
              <a
                href={currentVault.info.sourceURL}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={'whitespace-nowrap md:text-sm text-text-primary hover:underline'}
                suppressHydrationWarning
              >
                {currentVault.info.sourceURL}
              </a>
            </div>
          </div>
        ) : null}

        {liquidityUrl ? (
          <div className={'flex flex-col items-start md:flex-row md:items-center'}>
            <p className={'w-full text-sm text-text-secondary md:w-44'}>{isVelodrome ? 'Velodrome' : 'Aerodrome'}</p>
            <div className={'flex items-center gap-1 md:flex-1 md:justify-end'}>
              <a
                href={liquidityUrl}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'flex items-center gap-1 md:text-sm text-text-primary transition-colors hover:text-text-secondary'
                }
                suppressHydrationWarning
              >
                {isVelodrome ? 'Velodrome ' : 'Aerodrome '}
                {'Liquidity Pool Info'}
                <IconLinkOut className={'size-3'} />
              </a>
            </div>
          </div>
        ) : null}

        <div className={'flex flex-col items-start md:flex-row md:items-center'}>
          <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Current Price Per Share'}</p>
          <p className={'md:text-sm text-text-primary md:flex-1 md:text-right'} suppressHydrationWarning>
            {currentVault.apr.pricePerShare.today}
          </p>
        </div>

        {deployedLabel ? (
          <div className={'flex flex-col items-start md:flex-row md:items-center'}>
            <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Deployed on'}</p>
            <p className={'md:text-sm text-text-primary md:flex-1 md:text-right'} suppressHydrationWarning>
              {deployedLabel}
            </p>
          </div>
        ) : null}

        <div className={'flex flex-col items-start md:flex-row md:items-center'}>
          <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Powerglove Analytics Page'}</p>
          <div className={'flex items-center gap-1 md:flex-1 md:justify-end'}>
            <a
              href={powergloveUrl}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={
                'flex items-center gap-1 md:text-sm text-text-primary transition-colors hover:text-text-secondary'
              }
              suppressHydrationWarning
            >
              {'View Page'}
              <IconLinkOut className={'size-3'} />
            </a>
          </div>
        </div>

        <div className={'flex flex-col items-start md:flex-row md:items-center'}>
          <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Vault Snapshot Data'}</p>
          <div className={'flex items-center gap-1 md:flex-1 md:justify-end'}>
            <a
              href={`${KONG_REST_BASE}/snapshot/${currentVault.chainID}/${currentVault.address}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={
                'flex items-center gap-1 md:text-sm text-text-primary transition-colors hover:text-text-secondary'
              }
              suppressHydrationWarning
            >
              {'View API Data'}
              <IconLinkOut className={'size-3'} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
