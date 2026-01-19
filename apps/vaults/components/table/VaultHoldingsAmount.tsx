import { RenderAmount } from '@lib/components/RenderAmount'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import type { TNormalizedBN } from '@lib/types'
import { cl, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

export function VaultHoldingsAmount({
  currentVault,
  valueClassName
}: {
  currentVault: TYDaemonVault
  valueClassName?: string
}): ReactElement {
  const { getToken } = useWallet()
  const { isActive: isWalletActive } = useWeb3()
  const { getPrice } = useYearn()

  const { tokenPrice, staked, hasBalance } = useMemo(() => {
    const vaultToken = getToken({
      chainID: currentVault.chainID,
      address: currentVault.address
    })
    const price = getPrice({
      address: currentVault.address,
      chainID: currentVault.chainID
    })

    const stakingBalance = currentVault.staking.available
      ? getToken({
          chainID: currentVault.chainID,
          address: currentVault.staking.address
        }).balance.raw
      : 0n
    const totalRawBalance = vaultToken.balance.raw + stakingBalance

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
  const shouldShowDash = isWalletActive && !hasBalance

  return (
    <div className={'flex flex-col items-end pt-0 text-right'}>
      <p
        className={cl(
          'yearn--table-data-section-item-value',
          hasBalance ? 'text-text-primary' : 'text-text-tertiary',
          valueClassName
        )}
      >
        {shouldShowDash ? (
          '-'
        ) : (
          <RenderAmount
            value={isDusty ? 0 : value}
            symbol={'USD'}
            decimals={0}
            options={{
              shouldCompactValue: true,
              maximumFractionDigits: 2,
              minimumFractionDigits: 2
            }}
          />
        )}
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
