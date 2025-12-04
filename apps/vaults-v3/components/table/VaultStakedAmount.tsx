import { RenderAmount } from '@lib/components/RenderAmount'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import type { TNormalizedBN } from '@lib/types'
import { cl, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

export function VaultStakedAmount({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { getToken } = useWallet()
  const { getPrice } = useYearn()

  const { tokenPrice, staked, hasBalance } = useMemo(() => {
    const vaultToken = getToken({ chainID: currentVault.chainID, address: currentVault.address })
    const price = getPrice({ address: currentVault.address, chainID: currentVault.chainID })

    let totalRawBalance = vaultToken.balance.raw
    if (currentVault.staking.available) {
      const stakingToken = getToken({ chainID: currentVault.chainID, address: currentVault.staking.address })
      totalRawBalance += stakingToken.balance.raw
    }

    const total: TNormalizedBN = toNormalizedBN(totalRawBalance, vaultToken.decimals)
    return {
      tokenPrice: price,
      staked: total,
      hasBalance: total.raw > 0n
    }
  }, [
    currentVault.address,
    currentVault.chainID,
    currentVault.staking.address,
    currentVault.staking.available,
    getToken,
    getPrice
  ])

  const value = staked.normalized * tokenPrice.normalized

  const isDusty = value < 0.01

  return (
    <div className={'flex flex-col pt-0 text-right'}>
      <p className={`yearn--table-data-section-item-value ${hasBalance ? 'text-neutral-900' : 'text-neutral-400'}`}>
        <RenderAmount
          value={isDusty ? 0 : value}
          symbol={'USD'}
          decimals={0}
          options={{ shouldCompactValue: true, maximumFractionDigits: 2, minimumFractionDigits: 2 }}
        />
      </p>
      <small className={cl('text-xs text-neutral-900/40 flex flex-row', hasBalance ? 'visible' : 'invisible')}>
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
