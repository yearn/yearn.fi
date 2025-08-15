/** biome-ignore-all lint/performance/noImgElement: <img> elements are required for OG image generation because Next.js ImageResponse does not support the Next.js <Image> component, and <img> is the only way to render external images in the generated OG image. */

import { TypeMarkYearnNaughty } from '@lib/icons/TypeMarkYearn-naughty'
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

/**
 * There are over-rides for Katana and yBOLD that should be removed if the way those assets work is changed.
 * The logic for how the over-rides work is equivalent to how they work in the rest of the site.
 */

/**
 * Styles at the end of the file
 */

/**
 * OG Image Generation for Yearn V3 Vaults
 *
 * BUG To be aware of: JSX String Interpolation Issue
 * ================================================
 *
 * Problem: Using dynamic string interpolation directly in JSX elements inside
 * next/og ImageResponse causes parsing failures in the edge runtime.
 *
 * What BROKE (misleading error "Expected <div> to have explicit display: flex"):
 * ```tsx
 * <div>{displayData.name}</div>
 * <div>APY: {displayData.estimatedApy}</div>
 * <div>{chainName} • {address.slice(0, 6)}...{address.slice(-4)}</div>
 * ```
 *
 * What WORKS:
 * ```tsx
 * const vaultName = displayData.name
 * const apyText = `APY: ${displayData.estimatedApy}`
 * const footerText = `${chainName} • ${address.slice(0, 6)}...${address.slice(-4)}`
 *
 * // Then use simple variables in JSX:
 * <div>{vaultName}</div>
 * <div>{apyText}</div>
 * <div>{footerText}</div>
 * ```
 *
 * RULE: Always pre-compute ALL dynamic strings before the JSX return statement.
 * Never use template literals, object property access, or function calls inside JSX elements.
 * The edge runtime's JSX parser is extremely strict about this.
 *
 * The display css property must be set to 'flex' for all elements.
 */

interface VaultData {
  icon: string
  name: string
  estimatedApy: string
  historicalApy: string
  tvlUsd: string
  chainName: string
}

// Katana APR types (matching useKatanaAprs.ts)
type TKatanaAprData = {
  katanaRewardsAPR: number // legacy field for App rewards from Morpho, Sushi, Yearn, etc.
  katanaAppRewardsAPR: number // rewards from Morpho, Sushi, Yearn, etc.
  FixedRateKatanaRewards: number // fixed rate rewards from Katana
  katanaBonusAPY: number // bonus APR from Katana for not leaving the vault
  extrinsicYield: number // yield from underlying assets in bridge
  katanaNativeYield: number // yield from katana markets (the netAPR). This is subsidized if low.
}

type TKatanaAprs = {
  [key: string]: {
    apr: {
      netAPR: number
      extra: TKatanaAprData
    }
  }
}

// Chain identification functions
const ALLOWED_CHAIN_IDS = [1, 10, 137, 250, 8453, 42161, 747474]

// yBOLD vault constants
const YBOLD_VAULT_ADDRESS = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'
const YBOLD_STAKING_ADDRESS = '0x23346B04a7f55b8760E5860AA5A77383D63491cD'

function isValidChainID(chainID: string): boolean {
  // Only allow known chain IDs
  return ALLOWED_CHAIN_IDS.includes(Number(chainID))
}

function isValidEthereumAddress(address: string): boolean {
  // Accepts 40 hex chars, optionally prefixed with '0x'
  return /^0x[a-fA-F0-9]{40}$/.test(address) || /^[a-fA-F0-9]{40}$/.test(address)
}

// Utility functions
function getChainName(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'Ethereum'
    case 10:
      return 'Optimism'
    case 137:
      return 'Polygon'
    case 250:
      return 'Fantom'
    case 8453:
      return 'Base'
    case 42161:
      return 'Arbitrum'
    case 747474:
      return 'Katana'
    default:
      return `Chain ${chainId}`
  }
}

function formatUSD(amount: number): string {
  if (amount < 1000) return `$${amount.toFixed(2)}`
  if (amount < 1e6) return `$${(amount / 1e3).toFixed(2)}K`
  if (amount < 1e9) return `$${(amount / 1e6).toFixed(2)}M`
  if (amount < 1e12) return `$${(amount / 1e9).toFixed(2)}B`
  return `$${(amount / 1e12).toFixed(1)}T`
}

async function fetchVaultData(chainID: string, address: string) {
  // Additional security: ensure base URI is a trusted external service
  const baseUri = process.env.YDAEMON_BASE_URI
  if (!baseUri || !baseUri.startsWith('https://')) {
    console.error('Invalid or missing YDAEMON_BASE_URI')
    return null
  }

  try {
    const response = await fetch(
      `${baseUri}/${chainID}/vault/${address}?strategiesDetails=withDetails&strategiesCondition=inQueue`,
      {
        // Additional security headers and timeout
        headers: {
          'User-Agent': 'yearn.fi-og-generator/1.0'
        },
        // Prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      }
    )

    if (!response.ok) {
      console.error(`Failed to fetch vault data: ${response.status}`)
      return null
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching vault data:', error)
    return null
  }
}

async function fetchKatanaAprs(): Promise<TKatanaAprs | null> {
  const apiUrl = process.env.KATANA_APR_SERVICE_API
  if (!apiUrl) {
    console.error('KATANA_APR_SERVICE_API environment variable is not set')
    return null
  }

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'yearn.fi-og-generator/1.0'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      console.error(`Failed to fetch Katana APRs: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching Katana APRs:', error)
    return null
  }
}

async function fetchYBoldApr(chainID: string): Promise<{ estimatedAPY: number; historicalAPY: number } | null> {
  // Only fetch for Ethereum mainnet
  if (chainID !== '1') {
    return null
  }

  const baseUri = process.env.YDAEMON_BASE_URI
  if (!baseUri || !baseUri.startsWith('https://')) {
    console.error('Invalid or missing YDAEMON_BASE_URI')
    return null
  }

  try {
    const response = await fetch(
      `${baseUri}/${chainID}/vault/${YBOLD_STAKING_ADDRESS}?strategiesDetails=withDetails&strategiesCondition=inQueue`,
      {
        headers: {
          'User-Agent': 'yearn.fi-og-generator/1.0'
        },
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      console.error(`Failed to fetch yBOLD staking vault data: ${response.status}`)
      return null
    }

    const stYBoldVault = await response.json()

    if (!stYBoldVault?.apr) {
      console.error('yBOLD staking vault has no APR data')
      return null
    }

    return {
      estimatedAPY: stYBoldVault.apr.forwardAPR?.netAPR || stYBoldVault.apr.netAPR || 0,
      historicalAPY: stYBoldVault.apr.netAPR || 0
    }
  } catch (error) {
    console.error('Error fetching yBOLD APR:', error)
    return null
  }
}

function calculateKatanaAPY(katanaAprData: TKatanaAprData): number {
  // Exclude legacy katanaRewardsAPR to avoid double counting with katanaAppRewardsAPR
  const { katanaRewardsAPR: _katanaRewardsAPR, ...relevantAprs } = katanaAprData
  return Object.values(relevantAprs).reduce((sum, value) => sum + value, 0)
}

function calculateEstimatedAPY(
  vault: any,
  katanaAprs: TKatanaAprs | null = null,
  yBoldApr: { estimatedAPY: number; historicalAPY: number } | null = null
): number {
  if (!vault?.apr) return 0

  // Handle yBOLD vault special case
  if (vault.address.toLowerCase() === YBOLD_VAULT_ADDRESS.toLowerCase() && yBoldApr) {
    return yBoldApr.estimatedAPY
  }

  // Handle Katana vaults (chainID 747474)
  if (vault.chainID === 747474 && katanaAprs) {
    // Normalize address format to lowercase without 0x prefix for lookup
    const normalizedAddress = vault.address.toLowerCase().replace('0x', '')
    const vaultAddressWithPrefix = `0x${normalizedAddress}`

    const katanaAprData =
      katanaAprs[normalizedAddress]?.apr?.extra ||
      katanaAprs[vaultAddressWithPrefix]?.apr?.extra ||
      katanaAprs[vault.address]?.apr?.extra

    if (katanaAprData) {
      return calculateKatanaAPY(katanaAprData)
    }
    return 0 // No Katana APR data available
  }

  const sumOfRewardsAPY = (vault.apr.extra?.stakingRewardsAPR || 0) + (vault.apr.extra?.gammaRewardAPR || 0)

  if (vault.apr.forwardAPR?.type === '' || !vault.apr.forwardAPR?.type) {
    if ((vault.apr.extra?.stakingRewardsAPR || 0) > 0) {
      return (vault.apr.extra.stakingRewardsAPR || 0) + (vault.apr.netAPR || 0)
    }
    return vault.apr.netAPR || 0
  }

  if (vault.chainID === 1 && (vault.apr.forwardAPR.composite?.boost || 0) > 0 && !vault.apr.extra?.stakingRewardsAPR) {
    return vault.apr.forwardAPR.netAPR || 0
  }

  if (sumOfRewardsAPY > 0) {
    return sumOfRewardsAPY + (vault.apr.forwardAPR.netAPR || 0)
  }

  const hasCurrentAPY = (vault.apr.forwardAPR?.netAPR || 0) > 0
  if (hasCurrentAPY) {
    return vault.apr.forwardAPR.netAPR
  }

  return vault.apr.netAPR || 0
}

function calculateHistoricalAPY(
  vault: any,
  yBoldApr: { estimatedAPY: number; historicalAPY: number } | null = null
): number {
  // Handle yBOLD vault special case
  if (vault.address.toLowerCase() === YBOLD_VAULT_ADDRESS.toLowerCase() && yBoldApr) {
    return yBoldApr.historicalAPY
  }

  // Handle Katana vaults - they don't have historical data
  if (vault.chainID === 747474) {
    return -1 // Special value to indicate no historical data
  }

  if (!vault?.apr?.points) return 0
  const monthlyAPY = vault.apr.points.monthAgo || 0
  const weeklyAPY = vault.apr.points.weekAgo || 0
  return monthlyAPY > 0 ? monthlyAPY : weeklyAPY
}

export default async function handler(req: NextRequest) {
  const url = req.url || req.nextUrl?.pathname || ''
  // Extract chainID and address from the URL pattern: /api/og/{chainID}/{address}
  const match = url.match(/\/api\/og\/(\d+)\/([a-fA-F0-9x]+)/i)
  const chainID = match?.[1] || '1'
  const address = match?.[2] || ''
  // SSRF protection: validate chainID and address
  if (!isValidChainID(chainID) || !isValidEthereumAddress(address)) {
    // Optionally, return a 400 error or a default response
    return new Response('Invalid chainID or address', { status: 400 })
  }

  // Fetch real vault data
  const vaultData = await fetchVaultData(chainID, address)

  // Fetch Katana APRs if this is a Katana vault
  let katanaAprs: TKatanaAprs | null = null
  if (chainID === '747474') {
    katanaAprs = await fetchKatanaAprs()
  }

  // Fetch yBOLD APR data if this is the yBOLD vault
  let yBoldApr: { estimatedAPY: number; historicalAPY: number } | null = null
  if (address.toLowerCase() === YBOLD_VAULT_ADDRESS.toLowerCase()) {
    yBoldApr = await fetchYBoldApr(chainID)
  }

  let displayData: VaultData

  if (vaultData) {
    // Calculate real APY values using the same logic as your components
    const estimatedAPY = calculateEstimatedAPY(vaultData, katanaAprs, yBoldApr)
    const historicalAPY = calculateHistoricalAPY(vaultData, yBoldApr)

    displayData = {
      icon: `${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${vaultData.token.address}/logo-128.png`,
      name: vaultData.name?.replace(/\s+Vault$/, '') || 'Yearn Vault',
      estimatedApy: `${(estimatedAPY * 100).toFixed(2)}%`,
      historicalApy: historicalAPY === -1 ? '--%' : `${(historicalAPY * 100).toFixed(2)}%`,
      tvlUsd: formatUSD(vaultData.tvl?.tvl || 0),
      chainName: getChainName(parseInt(chainID, 10))
    }
  } else {
    // Fallback data if vault fetch fails
    displayData = {
      icon: `${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${address}/logo-128.png`,
      name: 'Yearn Vault',
      estimatedApy: '0.00%',
      historicalApy: '0.00%',
      tvlUsd: '$0',
      chainName: getChainName(parseInt(chainID, 10))
    }
  }
  // Whitelist of allowed hostnames
  const allowedHosts = ['yearn.fi', 'localhost:3000', 'localhost', 'app.yearn.fi']
  const rawOrigin = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  // Extract hostname (strip port if present)
  const originHost = rawOrigin.split(':')[0]
  const originPort = rawOrigin.split(':')[1]
  const validatedOrigin = allowedHosts.includes(rawOrigin)
    ? rawOrigin
    : allowedHosts.includes(originHost)
      ? originHost + (originPort ? ':' + originPort : '')
      : 'yearn.fi'
  const protocol = validatedOrigin.includes('localhost') ? 'http' : 'https'

  // Load Aeonik fonts with error handling
  let aeonikRegular: ArrayBuffer | undefined, aeonikBold: ArrayBuffer | undefined, aeonikMono: ArrayBuffer | undefined
  try {
    const regularRes = await fetch(`${protocol}://${validatedOrigin}/fonts/Aeonik-Regular.ttf`)
    if (!regularRes.ok) {
      throw new Error(`Failed to load Aeonik-Regular.ttf: ${regularRes.status} ${regularRes.statusText}`)
    }
    aeonikRegular = await regularRes.arrayBuffer()

    const boldRes = await fetch(`${protocol}://${validatedOrigin}/fonts/Aeonik-Bold.ttf`)
    if (!boldRes.ok) {
      throw new Error(`Failed to load Aeonik-Bold.ttf: ${boldRes.status} ${boldRes.statusText}`)
    }
    aeonikBold = await boldRes.arrayBuffer()

    const monoRes = await fetch(`${protocol}://${validatedOrigin}/fonts/AeonikMono-Regular.ttf`)
    if (!monoRes.ok) {
      throw new Error(`Failed to load AeonikMono-Regular.ttf: ${monoRes.status} ${monoRes.statusText}`)
    }
    aeonikMono = await monoRes.arrayBuffer()
  } catch (err) {
    return new Response(`Font loading error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 })
  }
  const vaultName = displayData.name
  const vaultIcon = displayData.icon
  const estimatedApyValue = displayData.estimatedApy
  const historicalApyValue = displayData.historicalApy
  const tvlValue = displayData.tvlUsd
  const footerText = `${displayData.chainName} | ${address.slice(0, 6)}...${address.slice(-4)}`
  const earnWithYearnText = 'Earn With Yearn'

  return new ImageResponse(
    <div style={styles.container}>
      <div style={styles.mainPanel}>
        {/* Info Panel */}
        <div style={styles.infoPanel}>
          {/* content */}
          <div style={styles.contentWrapper}>
            {/* Vault Info */}
            <div style={styles.vaultInfoContainer}>
              {/* Title block */}
              <div style={styles.titleBlock}>
                {/* Token Logo and Name */}
                <div style={styles.tokenHeader}>
                  {/* Token Logo */}
                  <img src={vaultIcon} alt={vaultName} width="48" height="48" style={styles.tokenIcon} />
                  {/* Token Name */}
                  <div style={styles.tokenName}>{vaultName}</div>
                </div>
                {/* Chain and Address */}
                <div style={styles.chainAddress}>{footerText}</div>
              </div>

              {/* Stats */}
              <div style={styles.statsContainer}>
                {/* Estimated APY */}
                <div style={styles.statRow}>
                  <div style={styles.statLabel}>Estimated APY:</div>
                  <div style={styles.statValue}>{estimatedApyValue}</div>
                </div>
                {/* Historical APY */}
                <div style={styles.statRow}>
                  <div style={styles.statLabel}>Historical APY:</div>
                  <div style={styles.secondaryStatValue}>{historicalApyValue}</div>
                </div>
                {/* Vault TVL */}
                <div style={styles.statRow}>
                  <div style={styles.statLabel}>Vault TVL:</div>
                  <div style={styles.tvlContainer}>
                    <div style={styles.secondaryStatValue}>{tvlValue}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          {/* TypeMark Logo */}
          <div style={styles.logoWrapper}>
            <TypeMarkYearnNaughty width={300} height={90} color="#FFFFFF" />
          </div>

          {/* Call to action */}
          <div style={styles.callToAction}>{earnWithYearnText}</div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Aeonik',
          data: aeonikRegular,
          weight: 400,
          style: 'normal'
        },
        {
          name: 'Aeonik',
          data: aeonikBold,
          weight: 700,
          style: 'normal'
        },
        {
          name: 'AeonikMono',
          data: aeonikMono,
          weight: 400,
          style: 'normal'
        }
      ]
    }
  )
}

// CSS styles for OG image components
// Note: Edge runtime only supports inline styles for ImageResponse
const styles = {
  // Layout containers
  container: {
    width: 1200,
    height: 630,
    display: 'flex',
    backgroundColor: 'white'
  } as React.CSSProperties,

  mainPanel: {
    flex: '1 1 0',
    alignSelf: 'stretch',
    background: 'linear-gradient(225deg, #b51055ff 0%, #263490ff 100%)',
    overflow: 'hidden',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    display: 'flex'
  } as React.CSSProperties,

  infoPanel: {
    alignSelf: 'stretch',
    paddingLeft: 70,
    paddingRight: 70,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    display: 'flex'
  } as React.CSSProperties,

  contentWrapper: {
    flex: '1 1 0',
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    display: 'flex'
  } as React.CSSProperties,

  vaultInfoContainer: {
    flex: '1 1 0',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 20,
    display: 'flex'
  } as React.CSSProperties,

  titleBlock: {
    alignSelf: 'stretch',
    height: 'auto',
    paddingTop: 56,
    paddingBottom: 20,
    gap: 6,
    overflow: 'hidden',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    display: 'flex'
  } as React.CSSProperties,

  tokenHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    display: 'flex'
  } as React.CSSProperties,

  tokenIcon: {
    borderRadius: 0
  } as React.CSSProperties,

  tokenName: {
    color: 'white',
    fontSize: 64,
    fontFamily: 'Aeonik',
    fontWeight: '700',
    wordWrap: 'break-word',
    overflow: 'visible'
  } as React.CSSProperties,

  chainAddress: {
    textAlign: 'right',
    color: 'white',
    fontSize: 28,
    fontFamily: 'Aeonik',
    fontWeight: '300',
    wordWrap: 'break-word'
  } as React.CSSProperties,

  statsContainer: {
    width: 450,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 30,
    display: 'flex'
  } as React.CSSProperties,

  statRow: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'center',
    display: 'flex'
  } as React.CSSProperties,

  statLabel: {
    textAlign: 'right',
    color: 'white',
    fontSize: 32,
    fontFamily: 'Aeonik',
    fontWeight: '300',
    wordWrap: 'break-word'
  } as React.CSSProperties,

  statValue: {
    textAlign: 'right',
    color: 'white',
    fontSize: 48,
    fontFamily: 'Aeonik',
    fontWeight: '700',
    wordWrap: 'break-word'
  } as React.CSSProperties,

  tvlContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    display: 'flex'
  } as React.CSSProperties,

  secondaryStatValue: {
    alignSelf: 'stretch',
    textAlign: 'right',
    color: 'white',
    fontSize: 32,
    fontFamily: 'Aeonik',
    fontWeight: '300',
    wordWrap: 'break-word'
  } as React.CSSProperties,

  footer: {
    width: '100%',
    paddingBottom: 40,
    paddingLeft: 70,
    paddingRight: 70,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    display: 'flex'
  } as React.CSSProperties,

  logoWrapper: {
    width: 309,
    height: 85,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start'
  } as React.CSSProperties,

  callToAction: {
    textAlign: 'right',
    color: 'white',
    fontSize: 48,
    fontFamily: 'Aeonik',
    fontWeight: '700',
    wordWrap: 'break-word'
  } as React.CSSProperties
}
