import { RenderAmount } from '@lib/components/RenderAmount'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import type { TNormalizedBN } from '@lib/types'
import { cl, isZero, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

export function VaultStakedAmount({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { getToken } = useWallet()
  const { getPrice } = useYearn()

  const tokenPrice = useMemo(
    () => getPrice({ address: currentVault.address, chainID: currentVault.chainID }),
    [currentVault.address, currentVault.chainID, getPrice]
  )
  const staked = useMemo((): TNormalizedBN => {
    const vaultToken = getToken({ chainID: currentVault.chainID, address: currentVault.address })
    if (currentVault.staking.available) {
      const stakingToken = getToken({ chainID: currentVault.chainID, address: currentVault.staking.address })
      return toNormalizedBN(vaultToken.balance.raw + stakingToken.balance.raw, stakingToken.decimals)
    }

    return toNormalizedBN(vaultToken.balance.raw, vaultToken.decimals)
  }, [
    currentVault.address,
    currentVault.chainID,
    currentVault.staking.address,
    currentVault.staking.available,
    getToken
  ])

  const value = staked.normalized * tokenPrice.normalized

  const isDusty = value < 0.01

  return (
    <div className={'flex flex-col pt-0 text-right'}>
      <p
        className={`yearn--table-data-section-item-value ${isZero(staked.raw) ? 'text-neutral-400' : 'text-neutral-900 font-bold'}`}
      >
        <RenderAmount
          value={isDusty ? 0 : value}
          symbol={'USD'}
          decimals={0}
          options={{ shouldCompactValue: true, maximumFractionDigits: 2, minimumFractionDigits: 2 }}
        />
      </p>
      <small className={cl('text-xs text-neutral-900/40 flex flex-row', isDusty ? 'invisible' : 'visible')}>
        <RenderAmount
          shouldFormatDust
          value={isDusty ? 0 : staked.normalized}
          symbol={currentVault.token.symbol}
          decimals={currentVault.token.decimals}
          options={{ shouldDisplaySymbol: false, maximumFractionDigits: 4 }}
        />
        <p className="pl-1">{currentVault.token.symbol}</p>
      </small>
    </div>
  )
}
