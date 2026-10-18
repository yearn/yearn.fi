import {
  YCRV_CHAIN_ID,
  YCRV_TOKEN_ADDRESS,
  YVCRVUSD_REWARD_ADDRESS
} from '@pages/portfolio/ycrv/constants'
import { buildYearnPricesSpotKey } from '@shared/utils/yearnPrices'
import type { TYearnPricesSpotResponse } from '@shared/utils/schemas/yearnPricesSpotSchema'

export type TYcrvPrices = {
  rewardPrice: number | null
  ycrvPrice: number | null
}

const YCRV_SPOT_KEY = buildYearnPricesSpotKey({ address: YCRV_TOKEN_ADDRESS, chainID: YCRV_CHAIN_ID })
const YVCRVUSD_SPOT_KEY = buildYearnPricesSpotKey({
  address: YVCRVUSD_REWARD_ADDRESS,
  chainID: YCRV_CHAIN_ID
})

const YCRV_SPOT_KEYS = [YCRV_SPOT_KEY, YVCRVUSD_SPOT_KEY].filter((key): key is string => Boolean(key))

export const YCRV_SPOT_ENDPOINT = `/api/prices/spot?coins=${encodeURIComponent(JSON.stringify(YCRV_SPOT_KEYS))}`

function getPositivePrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function resolveSpotPrice(
  response: TYearnPricesSpotResponse | undefined,
  key: string | null
): number | null {
  if (!response || !key) return null

  const coin = response.coins[key]
  if (!coin || coin.error) return null

  return getPositivePrice(coin.prices[0]?.price)
}

export function resolveYcrvPrices(response: TYearnPricesSpotResponse | undefined): TYcrvPrices {
  return {
    ycrvPrice: resolveSpotPrice(response, YCRV_SPOT_KEY),
    rewardPrice: resolveSpotPrice(response, YVCRVUSD_SPOT_KEY)
  }
}
