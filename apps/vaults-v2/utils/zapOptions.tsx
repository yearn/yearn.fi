import { ImageWithFallback } from '@lib/components/ImageWithFallback'

import type { TAddress, TDropdownOption } from '@lib/types'

type TSetZapOptionProps = {
  name: string
  symbol: string
  address: TAddress
  chainID: number
  decimals: number
}
export function setZapOption({
  name,
  symbol,
  address,
  chainID,
  decimals
}: TSetZapOptionProps): TDropdownOption {
  return {
    label: name,
    symbol,
    value: address,
    decimals,
    chainID,
    icon: (
      <ImageWithFallback
        src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainID}/${address.toLowerCase()}/logo-32.png`}
        alt={name}
        width={24}
        height={24}
      />
    )
  }
}
