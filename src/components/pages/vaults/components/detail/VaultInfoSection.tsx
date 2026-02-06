import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { baseFetcher, isZeroAddress, toAddress, truncateHex } from '@shared/utils'
import { copyToClipboard } from '@shared/utils/helpers'
import { isAutomatedVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi/utils'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'

type TCurvePoolEntry = {
  address?: string
  lpTokenAddress?: string
  lp_token_address?: string
  poolURLs?: { deposit?: string[] | null }
  poolUrls?: { deposit?: string[] | null }
  pool_urls?: { deposit?: string[] | null }
}

const CURVE_POOLS_CACHE_TTL_MS = 30 * 60 * 1000
const curvePoolsCache: {
  data: TCurvePoolEntry[] | null
  fetchedAt: number
  inflight: Promise<TCurvePoolEntry[]> | null
} = {
  data: null,
  fetchedAt: 0,
  inflight: null
}

const fetchCurvePoolsCached = async (): Promise<TCurvePoolEntry[]> => {
  const now = Date.now()
  if (curvePoolsCache.data && now - curvePoolsCache.fetchedAt < CURVE_POOLS_CACHE_TTL_MS) {
    return curvePoolsCache.data
  }
  if (curvePoolsCache.inflight) {
    return curvePoolsCache.inflight
  }

  curvePoolsCache.inflight = baseFetcher<unknown>('https://api.curve.finance/v1/getPools/all')
    .then((response) => {
      const pools = extractCurvePools(response)
      curvePoolsCache.data = pools
      curvePoolsCache.fetchedAt = Date.now()
      return pools
    })
    .finally(() => {
      curvePoolsCache.inflight = null
    })

  return curvePoolsCache.inflight
}

const extractCurvePools = (payload: unknown): TCurvePoolEntry[] => {
  if (!payload || typeof payload !== 'object') {
    return []
  }
  const root = payload as Record<string, unknown>
  const data = root.data as Record<string, unknown> | undefined
  const candidates = [root, data, data?.poolData, data?.pool_data, data?.pools, data?.data] as Array<unknown>

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as TCurvePoolEntry[]
    }
  }
  return []
}

const resolveCurveDepositUrl = (pools: TCurvePoolEntry[], tokenAddress: string): string => {
  const normalizedTarget = toAddress(tokenAddress)
  if (isZeroAddress(normalizedTarget)) {
    return ''
  }

  const match =
    pools.find((pool) => {
      const poolAddress = typeof pool?.address === 'string' ? toAddress(pool.address) : null
      return poolAddress === normalizedTarget
    }) ||
    pools.find((pool) => {
      const poolLpAddress =
        typeof pool?.lpTokenAddress === 'string'
          ? toAddress(pool.lpTokenAddress)
          : typeof pool?.lp_token_address === 'string'
            ? toAddress(pool.lp_token_address)
            : null
      return poolLpAddress === normalizedTarget
    })

  const urls = match?.poolURLs?.deposit ?? match?.poolUrls?.deposit ?? match?.pool_urls?.deposit ?? []

  return Array.isArray(urls) && typeof urls[0] === 'string' ? urls[0] : ''
}

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
  const sourceUrlLower = String(currentVault.info?.sourceURL || '').toLowerCase()
  const isVelodrome =
    currentVault.category?.toLowerCase() === 'velodrome' || sourceUrlLower.includes('velodrome.finance')
  const isAerodrome =
    currentVault.category?.toLowerCase() === 'aerodrome' || sourceUrlLower.includes('aerodrome.finance')
  const isCurveCategory = currentVault.category?.toLowerCase() === 'curve'
  const isCurveFactory = isCurveCategory && isAutomatedVault(currentVault)
  const [curvePoolUrl, setCurvePoolUrl] = useState('')
  useEffect(() => {
    if (!isCurveFactory) {
      setCurvePoolUrl('')
      return
    }
    const tokenAddress = currentVault.token.address
    if (isZeroAddress(toAddress(tokenAddress))) {
      setCurvePoolUrl('')
      return
    }

    let isActive = true
    const loadCurvePoolUrl = async (): Promise<void> => {
      try {
        const pools = await fetchCurvePoolsCached()
        const depositUrl = resolveCurveDepositUrl(pools, tokenAddress)
        if (isActive) {
          setCurvePoolUrl(depositUrl)
        }
      } catch {
        if (isActive) {
          setCurvePoolUrl('')
        }
      }
    }

    void loadCurvePoolUrl()
    return () => {
      isActive = false
    }
  }, [currentVault.token.address, isCurveFactory])
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

        {curvePoolUrl ? (
          <div className={'flex flex-col items-start md:flex-row md:items-center'}>
            <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Curve Pool URL'}</p>
            <div className={'flex items-center gap-1 md:flex-1 md:justify-end'}>
              <a
                href={curvePoolUrl}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'flex items-center gap-1 md:text-sm text-text-primary transition-colors hover:text-text-secondary'
                }
                suppressHydrationWarning
              >
                {'Liquidity Pool Info'}
                <IconLinkOut className={'size-3'} />
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
            <p className={'w-full text-sm text-text-secondary md:w-44'}>
              {isVelodrome ? 'Velodrome Pool URL' : 'Aerodrome Pool URL'}
            </p>
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
