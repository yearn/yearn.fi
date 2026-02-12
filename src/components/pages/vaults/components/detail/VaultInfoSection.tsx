import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import {
  getVaultAPR,
  getVaultAddress,
  getVaultCategory,
  getVaultChainID,
  getVaultInfo,
  getVaultStaking,
  getVaultToken,
  isAutomatedVault,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { baseFetcher, isCurveHostUrl, isZeroAddress, normalizeCurveUrl, toAddress, truncateHex } from '@shared/utils'
import { copyToClipboard } from '@shared/utils/helpers'
import { getNetwork } from '@shared/utils/wagmi/utils'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

type TCurvePoolEntry = {
  address?: string
  lpTokenAddress?: string
  poolUrls?: { deposit?: string[] | null }
}

type TCurvePoolsApiResponse = {
  data?: {
    poolData?: unknown
  }
}

const CURVE_POOLS_CACHE_TTL_MS = 30 * 60 * 1000
const CURVE_POOLS_CACHE_GC_MS = 60 * 60 * 1000
const CURVE_POOLS_ENDPOINT = 'https://api.curve.finance/v1/getPools/all'

export const extractCurvePools = (payload: unknown): TCurvePoolEntry[] => {
  const poolData = (payload as TCurvePoolsApiResponse | null)?.data?.poolData
  return Array.isArray(poolData) ? (poolData as TCurvePoolEntry[]) : []
}

export const resolveCurveDepositUrl = (pools: TCurvePoolEntry[], tokenAddress: string): string => {
  const normalizedTarget = toAddress(tokenAddress)
  if (isZeroAddress(normalizedTarget)) {
    return ''
  }

  for (const pool of pools) {
    const poolAddress = typeof pool?.address === 'string' ? toAddress(pool.address) : null
    const poolLpAddress = typeof pool?.lpTokenAddress === 'string' ? toAddress(pool.lpTokenAddress) : null
    if (poolAddress !== normalizedTarget && poolLpAddress !== normalizedTarget) {
      continue
    }

    const urls = pool.poolUrls?.deposit ?? []
    if (Array.isArray(urls) && typeof urls[0] === 'string') {
      return normalizeCurveUrl(urls[0])
    }
  }

  return ''
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
  currentVault: TKongVaultInput
  inceptTime?: number | null
}): ReactElement {
  const chainID = getVaultChainID(currentVault)
  const vaultAddress = getVaultAddress(currentVault)
  const token = getVaultToken(currentVault)
  const staking = getVaultStaking(currentVault)
  const info = getVaultInfo(currentVault)
  const apr = getVaultAPR(currentVault)
  const category = getVaultCategory(currentVault)
  const blockExplorer =
    getNetwork(chainID).blockExplorers?.etherscan?.url || getNetwork(chainID).blockExplorers?.default.url
  const sourceUrl = String(info?.sourceURL || '')
  const sourceUrlLower = sourceUrl.toLowerCase()
  const isVelodrome = category?.toLowerCase() === 'velodrome' || sourceUrlLower.includes('velodrome.finance')
  const isAerodrome = category?.toLowerCase() === 'aerodrome' || sourceUrlLower.includes('aerodrome.finance')
  const isCurveCategory = category?.toLowerCase() === 'curve'
  const isCurveFactory = isCurveCategory && isAutomatedVault(currentVault)
  const shouldFetchCurvePools = isCurveFactory && !isZeroAddress(toAddress(token.address))
  const { data: curvePoolUrl = '' } = useQuery({
    queryKey: ['curve-pools'],
    queryFn: async (): Promise<TCurvePoolEntry[]> => {
      const response = await baseFetcher<unknown>(CURVE_POOLS_ENDPOINT)
      return extractCurvePools(response)
    },
    select: (pools) => resolveCurveDepositUrl(pools, token.address),
    enabled: shouldFetchCurvePools,
    staleTime: CURVE_POOLS_CACHE_TTL_MS,
    gcTime: CURVE_POOLS_CACHE_GC_MS,
    refetchOnWindowFocus: false
  })
  const curveSourceUrl = isCurveCategory && isCurveHostUrl(sourceUrl) ? normalizeCurveUrl(sourceUrl) : ''
  const resolvedCurvePoolUrl = curvePoolUrl || curveSourceUrl
  const liquidityUrl = isVelodrome
    ? `https://velodrome.finance/liquidity?query=${token.address}`
    : isAerodrome
      ? `https://aerodrome.finance/liquidity?query=${token.address}`
      : ''
  const powergloveUrl = `https://powerglove.yearn.fi/vaults/${chainID}/${vaultAddress}`
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
        <AddressLink address={vaultAddress} explorerUrl={blockExplorer || ''} label={'Vault Contract Address'} />

        <AddressLink address={token.address} explorerUrl={blockExplorer || ''} label={'Token Contract Address'} />

        {staking.available ? (
          <AddressLink address={staking.address} explorerUrl={blockExplorer || ''} label={'Staking Contract Address'} />
        ) : null}

        {resolvedCurvePoolUrl ? (
          <div className={'flex flex-col items-start md:flex-row md:items-center'}>
            <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Curve Pool URL'}</p>
            <div className={'flex items-center gap-1 md:flex-1 md:justify-end'}>
              <a
                href={resolvedCurvePoolUrl}
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

        {(info?.sourceURL || '')?.includes('gamma') ? (
          <div className={'flex flex-col items-start md:flex-row md:items-center'}>
            <p className={'w-full text-sm text-text-secondary md:w-44'}>{'Gamma Pair'}</p>
            <div className={'flex md:flex-1 md:justify-end'}>
              <a
                href={info.sourceURL}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={'whitespace-nowrap md:text-sm text-text-primary hover:underline'}
                suppressHydrationWarning
              >
                {info.sourceURL}
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
            {apr.pricePerShare.today}
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
              href={`${KONG_REST_BASE}/snapshot/${chainID}/${vaultAddress}`}
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
