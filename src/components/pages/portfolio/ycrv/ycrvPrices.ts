import { YCRV_TOKEN_ADDRESS, YVCRVUSD_REWARD_ADDRESS } from '@pages/portfolio/ycrv/constants'

export type TYcrvPrices = {
  rewardPrice: number
  ycrvPrice: number
}

function getPositivePrice(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function resolveYcrvPrices({
  fallbackPrices,
  spotRewardPrice,
  spotYcrvPrice
}: {
  fallbackPrices: TYcrvPrices | null | undefined
  spotRewardPrice: number
  spotYcrvPrice: number
}): TYcrvPrices {
  const normalizedSpotYcrvPrice = getPositivePrice(spotYcrvPrice)
  const normalizedSpotRewardPrice = getPositivePrice(spotRewardPrice)

  return {
    ycrvPrice: normalizedSpotYcrvPrice || getPositivePrice(fallbackPrices?.ycrvPrice),
    rewardPrice: normalizedSpotRewardPrice || getPositivePrice(fallbackPrices?.rewardPrice)
  }
}

export async function fetchYDaemonYcrvPrices(yDaemonBaseUri: string): Promise<TYcrvPrices> {
  const tokenAddresses = [YCRV_TOKEN_ADDRESS, YVCRVUSD_REWARD_ADDRESS]
  const endpoint = `${yDaemonBaseUri}/prices/some/${tokenAddresses.join(',')}?humanized=true`
  const response = await fetch(endpoint)
  if (!response.ok) {
    throw new Error(`Unable to fetch yCRV prices (${response.status})`)
  }

  const payload = (await response.json()) as Record<string, unknown>
  const normalizedPrices = Object.entries(payload).reduce<Record<string, number>>((prices, [address, value]) => {
    prices[address.toLowerCase()] = getPositivePrice(value)
    return prices
  }, {})

  return {
    ycrvPrice: normalizedPrices[YCRV_TOKEN_ADDRESS.toLowerCase()] ?? 0,
    rewardPrice: normalizedPrices[YVCRVUSD_REWARD_ADDRESS.toLowerCase()] ?? 0
  }
}
