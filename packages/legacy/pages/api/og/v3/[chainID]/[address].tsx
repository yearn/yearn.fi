import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

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
 */

interface VaultData {
  icon: string
  name: string
  estimatedApy: string
  historicalApy: string
  tvlUsd: string
  chainName: string
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
  if (amount < 1e6) return `$${(amount / 1e3).toFixed(1)}K`
  if (amount < 1e9) return `$${(amount / 1e6).toFixed(1)}M`
  if (amount < 1e12) return `$${(amount / 1e9).toFixed(1)}B`
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

  // Fetch real vault data
  const vaultData = await fetchVaultData(chainID, address)

  let displayData: VaultData

  if (vaultData) {
    // Calculate real APY values using the same logic as your components
    const estimatedAPY = calculateEstimatedAPY(vaultData)
    const historicalAPY = calculateHistoricalAPY(vaultData)

    displayData = {
      icon: `${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${address}/logo-128.png`,
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

  // Pre-compute all strings to avoid JSX interpolation issues
  const vaultName = displayData.name
  const estimatedApyText = `Estimated APY: ${displayData.estimatedApy}`
  const historicalApyText = `Historical APY: ${displayData.historicalApy}`
  const tvlText = `TVL: ${displayData.tvlUsd}`
  const footerText = `${displayData.chainName} • ${address.slice(0, 6)}...${address.slice(-4)}`

  return new ImageResponse(
    <div tw="flex w-[1200px] h-[630px] bg-gradient-to-r from-[#2C3DA6] to-[#D21162] text-white">
      {/* Left side content */}
      <div tw="flex flex-col justify-between w-[700px] p-[60px]">
        {/* Title */}
        <div tw="text-[48px] font-bold leading-tight mb-[40px]">{vaultName}</div>

        {/* Stats */}
        <div tw="flex flex-col">
          <div tw="text-[32px] font-bold mb-[16px]">{estimatedApyText}</div>
          <div tw="text-[24px] mb-[16px]">{historicalApyText}</div>
          <div tw="text-[24px] mb-[40px]">{tvlText}</div>
        </div>

        {/* Footer */}
        <div tw="text-[18px] opacity-80">{footerText}</div>
      </div>

      {/* Right side icon */}
      <div tw="flex items-center justify-center w-[500px]">
        <div tw="flex items-center justify-center w-[120px] h-[120px] bg-white rounded-[60px] text-[48px]">🏛️</div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630
    }
  )
}
