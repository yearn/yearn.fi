import { ImageWithFallback } from '@lib/components/ImageWithFallback'

import type { TAddress, TDropdownOption } from '@lib/types'
import type { TSolver } from '@lib/utils/schemas/yDaemonTokenListBalances'

type TSetZapOptionProps = {
  name: string
  symbol: string
  address: TAddress
  chainID: number
  decimals: number
  solveVia?: TSolver[]
}
export function setZapOption({
  name,
  symbol,
  address,
  chainID,
  decimals,
  solveVia
}: TSetZapOptionProps): TDropdownOption {
  return {
    label: name,
    symbol,
    value: address,
    decimals,
    solveVia,
    chainID,
    icon: (
      <ImageWithFallback
        src={`https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/${chainID}/${address.toLowerCase()}/logo-32.png`}
        alt={name}
        width={24}
        height={24}
      />
    )
  }
}
