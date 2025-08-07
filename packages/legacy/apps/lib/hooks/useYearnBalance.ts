import type { TAddress, TDict, TNormalizedBN } from '@lib/types'
import { toAddress } from '@lib/utils'
import { useWallet } from '../contexts/useWallet'

/******************************************************************************
 ** The useYearnBalance hook is used to retrieve the balance of a token from
 ** the useYearn context.
 *****************************************************************************/
export function useYearnBalance({
  address,
  chainID
}: {
  address: string | TAddress
  chainID: number
  source?: TDict<TNormalizedBN>
}): TNormalizedBN {
  const { getBalance } = useWallet()

  return getBalance({ address: toAddress(address), chainID: chainID })
}
