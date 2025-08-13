/** biome-ignore-all lint/performance/noImgElement: <img> elements are required for OG image generation because Next.js ImageResponse does not support the Next.js <Image> component, and <img> is the only way to render external images in the generated OG image. */

import { TypeMarkYearnNaughty } from '@lib/icons/TypeMarkYearn-naughty'
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

// Tailwind-like utility function for OG image generation
// Since edge runtime doesn't support Tailwind CSS, we create inline styles
function tw(classes: string): React.CSSProperties {
  const classMap: Record<string, React.CSSProperties> = {
    // Layout
    'w-full': { width: '100%' },
    'w-[1200px]': { width: 1200 },
    'w-[309px]': { width: 309 },
    'w-[450px]': { width: 450 },
    'h-full': { height: '100%' },
    'h-[630px]': { height: 630 },
    'h-[85px]': { height: 85 },
    'h-[168px]': { height: 168 },
    'h-[300px]': { height: 300 },
    'h-[48px]': { height: 48 },

    // Display
    flex: { display: 'flex' },
    'flex-col': { flexDirection: 'column' },
    'flex-1': { flex: '1 1 0' },

    // Alignment
    'items-center': { alignItems: 'center' },
    'items-start': { alignItems: 'flex-start' },
    'items-end': { alignItems: 'flex-end' },
    'justify-center': { justifyContent: 'center' },
    'justify-start': { justifyContent: 'flex-start' },
    'justify-end': { justifyContent: 'flex-end' },
    'justify-between': { justifyContent: 'space-between' },
    'self-stretch': { alignSelf: 'stretch' },
    'text-right': { textAlign: 'right' },
    'text-left': { textAlign: 'left' },

    // Spacing
    'gap-5': { gap: 20 },
    'gap-3': { gap: 12 },
    'p-0': { padding: 0 },
    'px-[70px]': { paddingLeft: 70, paddingRight: 70 },
    'pt-[60px]': { paddingTop: 60 },
    'pb-5': { paddingBottom: 20 },
    'pb-[40px]': { paddingBottom: 40 },
    '-mt-px': { marginTop: -1 },

    // Colors
    'bg-white': { backgroundColor: 'white' },
    'text-white': { color: 'white' },
    'bg-gradient-yearn': {
      background: 'linear-gradient(225deg, #a20f4cff 0%, #233087ff 100%)'
    },

    // Typography
    'text-[64px]': { fontSize: 64 },
    'text-[48px]': { fontSize: 48 },
    'text-[32px]': { fontSize: 32 },
    'text-xl': { fontSize: 20 },
    'font-aeonik': { fontFamily: 'Aeonik' },
    'font-aeonik-mono': { fontFamily: 'AeonikMono' },
    'font-bold': { fontWeight: '700' },
    'font-medium': { fontWeight: '500' },
    'font-normal': { fontWeight: '400' },
    'break-words': { wordWrap: 'break-word' },

    // Borders
    'rounded-[24px]': { borderRadius: 24 },

    // Other
    'overflow-hidden': { overflow: 'hidden' },
    'object-contain': { objectFit: 'contain' }
  }

  return classes.split(' ').reduce((styles, className) => {
    const style = classMap[className.trim()]
    if (style) {
      for (const [key, value] of Object.entries(style)) {
        styles[key as keyof React.CSSProperties] = value
      }
    }
    return styles
  }, {} as React.CSSProperties)
}

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

// Chain identification functions
const ALLOWED_CHAIN_IDS = [1, 10, 137, 250, 8453, 42161, 747474]

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
  const plasticLogo = `${protocol}://${validatedOrigin}/3d-logo-bw.png`

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
    <div style={tw('w-[1200px] h-[630px] flex bg-white')}>
      <div
        style={tw('flex-1 self-stretch bg-gradient-yearn overflow-hidden flex-col justify-between items-center flex')}
      >
        {/* Info Panel */}
        <div style={tw('self-stretch px-[70px] justify-start items-start flex')}>
          {/* content */}
          <div style={tw('flex-1 self-stretch justify-center items-center flex')}>
            {/* Vault Info */}
            <div style={tw('flex-1 h-full flex-col justify-center items-start gap-5 flex')}>
              {/* Title block */}
              <div
                style={tw(
                  'self-stretch h-[168px] pt-[60px] pb-5 overflow-hidden flex-col justify-center items-start flex'
                )}
              >
                {/* Token Logo and Name */}
                <div style={tw('justify-center items-center gap-5 flex')}>
                  {/* Token Logo */}
                  <img src={vaultIcon} alt={vaultName} width="48" height="48" />
                  {/* Token Name */}
                  <div style={tw('text-white text-[64px] font-aeonik font-bold break-words')}>{vaultName}</div>
                </div>
                {/* Chain and Address */}
                <div style={tw('text-right text-white text-xl font-aeonik font-medium break-words -mt-px')}>
                  {footerText}
                </div>
              </div>

              {/* Stats */}
              <div style={tw('w-[450px] flex-col justify-start items-start gap-5 flex')}>
                {/* Estimated APY */}
                <div style={tw('self-stretch justify-between items-center flex')}>
                  <div style={tw('text-left text-white text-[32px] font-aeonik font-normal break-words')}>
                    Expected APY:
                  </div>
                  <div style={tw('text-right text-white text-[48px] font-aeonik font-bold break-words')}>
                    {estimatedApyValue}
                  </div>
                </div>
                {/* Historical APY */}
                <div style={tw('self-stretch justify-between items-center flex')}>
                  <div style={tw('text-left text-white text-[32px] font-aeonik font-normal break-words')}>
                    Historical APY:
                  </div>
                  <div style={tw('text-right text-white text-[32px] font-aeonik font-normal break-words')}>
                    {historicalApyValue}
                  </div>
                </div>
                {/* Vault TVL */}
                <div style={tw('self-stretch justify-between items-center flex')}>
                  <div style={tw('text-left text-white text-[32px] font-aeonik font-normal break-words')}>
                    Vault TVL:
                  </div>
                  <div style={tw('flex-col justify-end items-end flex')}>
                    <div
                      style={tw('self-stretch text-right text-white text-[32px] font-aeonik font-normal break-words')}
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
        <div style={tw('w-full pb-[40px] px-[70px] justify-between items-end flex')}>
          {/* TypeMark Logo */}
          <div style={tw('w-[309px] h-[85px] flex items-center justify-start')}>
            <TypeMarkYearnNaughty width={300} height={90} color="#FFFFFF" />
          </div>

          {/* Call to action */}
          <div style={tw('text-right text-white text-[48px] font-aeonik font-bold break-words')}>
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
