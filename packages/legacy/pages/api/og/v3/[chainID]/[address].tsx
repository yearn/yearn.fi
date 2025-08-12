/** biome-ignore-all lint/performance/noImgElement: <img> elements are required for OG image generation because Next.js ImageResponse does not support the Next.js <Image> component, and <img> is the only way to render external images in the generated OG image. */
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { TypeMarkYearn } from '../../../../../apps/lib/icons/TypeMarkYearn-naughty'

export const runtime = 'edge'

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

// Chain identification and currency formatting utility functions
const ALLOWED_CHAIN_IDS = [1, 10, 137, 250, 8453, 42161, 747474];

function isValidChainID(chainID: string): boolean {
  // Only allow known chain IDs
  return ALLOWED_CHAIN_IDS.includes(Number(chainID));
}

function isValidEthereumAddress(address: string): boolean {
  // Accepts 40 hex chars, optionally prefixed with '0x'
  return /^0x[a-fA-F0-9]{40}$/.test(address) || /^[a-fA-F0-9]{40}$/.test(address);
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
  try {
    const response = await fetch(
      `${process.env.YDAEMON_BASE_URI}/${chainID}/vault/${address}?strategiesDetails=withDetails&strategiesCondition=inQueue`
    )

    if (!response.ok) {
      console.error(`Failed to fetch vault data: ${response.status}`)
      return null
    }
  if (vault.chainID === KATANA_CHAIN_ID) {
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching vault data:', error)
    return null
  }
}

function calculateEstimatedAPY(vault: any): number {
  if (!vault?.apr) return 0

  // Handle Katana vaults (chainID 747474)
  if (vault.chainID === 747474) {
    return 0 // Would need katana context for real calculation
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

function calculateHistoricalAPY(vault: any): number {
  if (!vault?.apr?.points) return 0
  const monthlyAPY = vault.apr.points.monthAgo || 0
  const weeklyAPY = vault.apr.points.weekAgo || 0
  return monthlyAPY > 0 ? monthlyAPY : weeklyAPY
}

export default async function handler(req: NextRequest) {
  const url = req.url || req.nextUrl?.pathname || ''
  const match = url.match(/v3\/(\d+)\/([a-zA-Z0-9]+)/)
  const chainID = match?.[1] || '1'
  const address = match?.[2] || ''

  // SSRF protection: validate chainID and address
  if (!isValidChainID(chainID) || !isValidEthereumAddress(address)) {
    // Optionally, return a 400 error or a default response
    return new Response('Invalid chainID or address', { status: 400 })
  }

  // Fetch real vault data
  const vaultData = await fetchVaultData(chainID, address)

  let displayData: VaultData

  if (vaultData) {
    // Calculate real APY values using the same logic as your components
    const estimatedAPY = calculateEstimatedAPY(vaultData)
    const historicalAPY = calculateHistoricalAPY(vaultData)

    displayData = {
      icon: `${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${vaultData.token.address}/logo-128.png`,
      name: vaultData.name?.replace(/\s+Vault$/, '') || 'Yearn Vault',
      estimatedApy: `${(estimatedAPY * 100).toFixed(2)}%`,
      historicalApy: `${(historicalAPY * 100).toFixed(2)}%`,
      tvlUsd: formatUSD(vaultData.tvl?.tvl || 0),
      chainName: getChainName(parseInt(chainID))
    }
  } else {
    // Fallback data if vault fetch fails
    displayData = {
      icon: `${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${address}/logo-128.png`,
      name: 'Yearn Vault',
      estimatedApy: '0.00%',
      historicalApy: '0.00%',
      tvlUsd: '$0',
      chainName: getChainName(parseInt(chainID))
  // Whitelist of allowed hostnames
  const allowedHosts = ['yearn.fi', 'localhost:3000', 'localhost', 'app.yearn.fi'];
  let rawOrigin = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  // Extract hostname (strip port if present)
  let originHost = rawOrigin.split(':')[0];
  let originPort = rawOrigin.split(':')[1];
  let validatedOrigin = allowedHosts.includes(rawOrigin)
    ? rawOrigin
    : allowedHosts.includes(originHost)
      ? originHost + (originPort ? ':' + originPort : '')
      : 'yearn.fi';
  const protocol = validatedOrigin.includes('localhost') ? 'http' : 'https';
  const plasticLogo = `${protocol}://${validatedOrigin}/3d-logo-bw.png`;

  // Load Aeonik fonts
  const aeonikRegular = await fetch(`${protocol}://${validatedOrigin}/fonts/Aeonik-Regular.ttf`).then((res) => res.arrayBuffer())
  const aeonikBold = await fetch(`${protocol}://${validatedOrigin}/fonts/Aeonik-Bold.ttf`).then((res) => res.arrayBuffer())
  const aeonikMono = await fetch(`${protocol}://${validatedOrigin}/fonts/AeonikMono-Regular.ttf`).then((res) =>
  }

  // Load Aeonik fonts with error handling
  let aeonikRegular, aeonikBold, aeonikMono;
  try {
    const regularRes = await fetch(`${protocol}://${origin}/fonts/Aeonik-Regular.ttf`);
    if (!regularRes.ok) {
      throw new Error(`Failed to load Aeonik-Regular.ttf: ${regularRes.status} ${regularRes.statusText}`);
    }
    aeonikRegular = await regularRes.arrayBuffer();

    const boldRes = await fetch(`${protocol}://${origin}/fonts/Aeonik-Bold.ttf`);
    if (!boldRes.ok) {
      throw new Error(`Failed to load Aeonik-Bold.ttf: ${boldRes.status} ${boldRes.statusText}`);
    }
    aeonikBold = await boldRes.arrayBuffer();

    const monoRes = await fetch(`${protocol}://${origin}/fonts/AeonikMono-Regular.ttf`);
    if (!monoRes.ok) {
      throw new Error(`Failed to load AeonikMono-Regular.ttf: ${monoRes.status} ${monoRes.statusText}`);
    }
    aeonikMono = await monoRes.arrayBuffer();
  } catch (err) {
    return new Response(
      `Font loading error: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
  const vaultName = displayData.name
  const vaultIcon = displayData.icon
  const estimatedApyValue = displayData.estimatedApy
  const historicalApyValue = displayData.historicalApy
  const tvlValue = displayData.tvlUsd
  const footerText = `${displayData.chainName} | ${address.slice(0, 6)}...${address.slice(-4)}`
  const earnWithYearnText = 'Earn With Yearn'
  // Use absolute URL for /public/3d-logo-png
  const origin = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'yearn.fi'
  const protocol = origin.includes('localhost') ? 'http' : 'https'
  const plasticLogo = `${protocol}://${origin}/3d-logo-bw.png`

  // Load Aeonik fonts
  const aeonikRegular = await fetch(`${protocol}://${origin}/fonts/Aeonik-Regular.ttf`).then((res) => res.arrayBuffer())
  const aeonikBold = await fetch(`${protocol}://${origin}/fonts/Aeonik-Bold.ttf`).then((res) => res.arrayBuffer())
  const aeonikMono = await fetch(`${protocol}://${origin}/fonts/AeonikMono-Regular.ttf`).then((res) =>
    res.arrayBuffer()
  )

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: 'flex',
        backgroundColor: 'white'
      }}
    >
      <div
        style={{
          flex: '1 1 0',
          alignSelf: 'stretch',
          background: 'linear-gradient(225deg, #D21162 0%, #2C3DA6 100%)',
          overflow: 'hidden',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'flex'
        }}
      >
        {/* Info Panel */}
        <div
          style={{
            alignSelf: 'stretch',
            paddingLeft: 70,
            paddingRight: 70,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            display: 'flex'
          }}
        >
          {/* content */}
          <div
            style={{
              flex: '1 1 0',
              alignSelf: 'stretch',
              justifyContent: 'center',
              alignItems: 'center',
              display: 'flex'
            }}
          >
            {/* 3d logo image */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={plasticLogo}
                alt="Yearn 3D Logo"
                width="300"
                height="300"
                style={{
                  objectFit: 'contain'
                }}
              />
            </div>

            {/* Vault Info */}
            <div
              style={{
                flex: '1 1 0',
                height: '100%',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-end',
                gap: 20,
                display: 'flex'
              }}
            >
              {/* Title block */}
              <div
                style={{
                  alignSelf: 'stretch',
                  height: 168,
                  paddingTop: 60,
                  paddingBottom: 20,
                  overflow: 'hidden',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  display: 'flex'
                }}
              >
                {/* Token Logo and Name */}
                <div style={{ justifyContent: 'center', alignItems: 'center', gap: 20, display: 'flex' }}>
                  {/* Token Logo */}
                  <img src={vaultIcon} alt={vaultName} width="48" height="48" style={{ borderRadius: 24 }} />
                  {/* Token Name */}
                  <div
                    style={{
                      color: 'white',
                      fontSize: 64,
                      fontFamily: 'Aeonik',
                      fontWeight: '700',
                      wordWrap: 'break-word'
                    }}
                  >
                    {vaultName}
                  </div>
                </div>
                {/* Chain and Address */}
                <div
                  style={{
                    textAlign: 'right',
                    color: 'white',
                    fontSize: 20,
                    fontFamily: 'Aeonik',
                    fontWeight: '500',
                    wordWrap: 'break-word',
                    marginTop: -1
                  }}
                >
                  {footerText}
                </div>
              </div>

              {/* Stats */}
              <div
                style={{
                  width: 450,
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 12,
                  display: 'flex'
                }}
              >
                {/* Estimated APY */}
                <div
                  style={{
                    alignSelf: 'stretch',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    display: 'flex'
                  }}
                >
                  <div
                    style={{
                      textAlign: 'right',
                      color: 'white',
                      fontSize: 32,
                      fontFamily: 'Aeonik',
                      fontWeight: '400',
                      wordWrap: 'break-word'
                    }}
                  >
                    Estimated APY:
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      color: 'white',
                      fontSize: 48,
                      fontFamily: 'AeonikMono',
                      fontWeight: '700',
                      wordWrap: 'break-word'
                    }}
                  >
                    {estimatedApyValue}
                  </div>
                </div>
                {/* Historical APY */}
                <div
                  style={{
                    alignSelf: 'stretch',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    display: 'flex'
                  }}
                >
                  <div
                    style={{
                      textAlign: 'right',
                      color: 'white',
                      fontSize: 32,
                      fontFamily: 'Aeonik',
                      fontWeight: '400',
                      wordWrap: 'break-word'
                    }}
                  >
                    Historical APY:
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      color: 'white',
                      fontSize: 48,
                      fontFamily: 'AeonikMono',
                      fontWeight: '700',
                      wordWrap: 'break-word'
                    }}
                  >
                    {historicalApyValue}
                  </div>
                </div>
                {/* Vault TVL */}
                <div
                  style={{
                    alignSelf: 'stretch',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    display: 'flex'
                  }}
                >
                  <div
                    style={{
                      textAlign: 'right',
                      color: 'white',
                      fontSize: 32,
                      fontFamily: 'Aeonik',
                      fontWeight: '400',
                      wordWrap: 'break-word'
                    }}
                  >
                    Vault TVL:
                  </div>
                  <div
                    style={{
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'flex-end',
                      display: 'flex'
                    }}
                  >
                    <div
                      style={{
                        alignSelf: 'stretch',
                        textAlign: 'right',
                        color: 'white',
                        fontSize: 48,
                        fontFamily: 'AeonikMono',
                        fontWeight: '700',
                        wordWrap: 'break-word'
                      }}
                    >
                      {tvlValue}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            width: '100%',
            paddingBottom: 40,
            paddingLeft: 70,
            paddingRight: 70,
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            display: 'flex'
          }}
        >
          {/* TypeMark Logo */}
          <div
            style={{
              width: 309,
              height: 85,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start'
            }}
          >
            <TypeMarkYearn width={300} height={90} color="#FFFFFF" />
          </div>

          {/* Call to action */}
          <div
            style={{
              textAlign: 'right',
              color: 'white',
              fontSize: 48,
              fontFamily: 'Aeonik',
              fontWeight: '700',
              wordWrap: 'break-word'
            }}
          >
            {earnWithYearnText}
          </div>
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
