import type { TAddress, TToken } from '@shared/types'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'
import { useWallet } from '../contexts/useWallet'

/******************************************************************************
 ** The useYearnToken hook is used to retrieve the token from the useWallet
 ** context. The token is returned as a TToken.
 *****************************************************************************/
export function useYearnToken({ address, chainID }: { address: string | TAddress; chainID: number }): TToken {
  const { getToken } = useWallet()

  const balance = useMemo((): TToken => {
    return getToken({ address: toAddress(address), chainID: chainID })
  }, [getToken, address, chainID])

  return balance
}
