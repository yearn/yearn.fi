import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { formatAmount, formatApyDisplay, isZero, toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement, ReactNode } from 'react'

function HoldingsPill({ vault }: { vault: TYDaemonVault }): ReactElement {
  const data = useVaultApyData(vault)

  const isVeYfi = vault.staking.source === 'VeYFI'
  const boostedApr = data.baseForwardApr + data.rewardsAprSum
  const katanaApr = data.katanaEstApr ?? data.baseForwardApr

  const apyContent: ReactNode = (() => {
    if (data.mode === 'katana' && data.katanaEstApr !== undefined) {
      return (
        <>
          <span>{'⚔️ '}</span>
          <span className={'font-semibold'}>{formatApyDisplay(katanaApr)}</span>
        </>
      )
    }

    if (data.mode === 'rewards') {
      if (isVeYfi && data.estAprRange) {
        return (
          <>
            <span>{'⚡️ '}</span>
            <span className={'font-semibold'}>{formatApyDisplay(data.estAprRange[0])}</span>
            <span>{' → '}</span>
            <span className={'font-semibold'}>{formatApyDisplay(data.estAprRange[1])}</span>
          </>
        )
      }

      return (
        <>
          <span>{'⚡️ '}</span>
          <span className={'font-semibold'}>{formatApyDisplay(boostedApr)}</span>
        </>
      )
    }

    if (data.mode === 'boosted' && data.isBoosted) {
      return (
        <>
          <span>{'🚀 '}</span>
          <span className={'font-semibold'}>{formatApyDisplay(vault.apr.forwardAPR.netAPR)}</span>
          {data.boost ? (
            <span className={'text-[0.65rem] uppercase tracking-wide text-text-primary/70'}>
              {` • Boost ${formatAmount(data.boost, 2, 2)}x`}
            </span>
          ) : null}
        </>
      )
    }

    if (!isZero(data.baseForwardApr)) {
      return (
        <>
          <span>{'APY '}</span>
          <span className={'font-semibold'}>{formatApyDisplay(data.baseForwardApr)}</span>
        </>
      )
    }

    return (
      <>
        <span>{'Hist. '}</span>
        <span className={'font-semibold'}>{formatApyDisplay(data.netApr)}</span>
      </>
    )
  })()

  const tokenLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${toAddress(
    vault.token.address
  ).toLowerCase()}/logo-128.png`

  return (
    <div className={'relative w-40'}>
      <div
        className={
          'relative z-10 flex w-full min-w-0 items-center gap-2 rounded-lg bg-[#2a1956eb]/50 px-3 py-2 text-mobile-label text-text-primary backdrop-blur-lg'
        }
      >
        <div className={'flex w-full min-w-0 flex-col gap-1'}>
          <div className={'flex w-full min-w-0 items-center gap-2'}>
            <div className={'flex shrink-0 items-center justify-center'}>
              <div className={'h-4 w-4 overflow-hidden rounded-full'}>
                <ImageWithFallback
                  src={tokenLogoSrc}
                  alt={vault.token.symbol || ''}
                  width={16}
                  height={16}
                  className={'h-full w-full object-cover'}
                />
              </div>
            </div>
            <div className={'truncate text-left text-base font-semibold text-text-primary'}>{vault.name}</div>
          </div>
          <div className={'flex flex-row items-center gap-1 text-mobile-label text-text-primary'}> {apyContent} </div>
        </div>
      </div>
    </div>
  )
}

export default HoldingsPill
