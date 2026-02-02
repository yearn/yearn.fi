import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import type { TNormalizedBN } from '@shared/types'
import { cl, formatTvlDisplay, isZeroAddress, toNormalizedBN, zeroNormalizedBN } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

export function VaultHoldingsAmount({
  currentVault,
  valueClassName
}: {
  currentVault: TYDaemonVault
  valueClassName?: string
}): ReactElement {
  const { getBalance } = useWallet()
  const { address } = useWeb3()
  const isWalletActive = !!address
  const { getPrice } = useYearn()

  const { tokenPrice, staked, hasBalance } = useMemo(() => {
    const vaultBalance = getBalance({
      chainID: currentVault.chainID,
      address: currentVault.address
    })
    const price = getPrice({
      address: currentVault.address,
      chainID: currentVault.chainID
    })

    const stakingBalance = !isZeroAddress(currentVault.staking.address)
      ? getBalance({
          chainID: currentVault.chainID,
          address: currentVault.staking.address
        })
      : zeroNormalizedBN

    const totalRawBalance = vaultBalance.raw + stakingBalance.raw
    const total: TNormalizedBN = toNormalizedBN(totalRawBalance, currentVault.decimals)
    return {
      tokenPrice: price,
      staked: total,
      hasBalance: total.raw > 0n
    }
  }, [
    currentVault.address,
    currentVault.chainID,
    currentVault.staking.address,
    getPrice,
    currentVault.decimals,
    getBalance
  ])

  const value = staked.normalized * tokenPrice.normalized
  const isDusty = value < 0.01
  const shouldShowDash = isWalletActive && !hasBalance

  return (
    <div className={'flex flex-col items-end pt-0 text-right'}>
      <p
        className={cl(
          'yearn--table-data-section-item-value font-semibold',
          hasBalance ? 'text-text-primary' : 'text-text-tertiary',
          valueClassName
        )}
      >
        {shouldShowDash ? '-' : formatTvlDisplay(isDusty ? 0 : value)}
      </p>
      {/* <small
        className={cl(
          'text-xs text-text-primary/40 flex flex-row',
          hasBalance ? 'visible' : 'invisible'
        )}
      >
        <RenderAmount
          shouldFormatDust
          value={
            isDusty
              ? 0
              : staked.normalized * currentVault.apr.pricePerShare.today
          }
          symbol={currentVault.token.symbol}
          decimals={currentVault.token.decimals}
          options={{ shouldDisplaySymbol: false, maximumFractionDigits: 4 }}
        />
        <p className="pl-1">{currentVault.token.symbol}</p>
      </small> */}
    </div>
  )
}
