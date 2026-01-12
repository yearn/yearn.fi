import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { formatAmount, isZero, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useVaultApyData } from '@vaults/hooks/useVaultApyData'
import type { ReactElement, ReactNode } from 'react'

function HoldingsPill({ vault }: { vault: TYDaemonVault }): ReactElement {
  const data = useVaultApyData(vault)

  const isVeYfi = vault.staking.source === 'VeYFI'
  const boostedApr = data.baseForwardApr + data.rewardsAprSum
  const katanaApr = data.katanaTotalApr ?? data.baseForwardApr

  const apyContent: ReactNode = (() => {
    if (data.mode === 'katana' && data.katanaTotalApr !== undefined) {
      return (
        <>
          <span>{'⚔️ '}</span>
          <RenderAmount shouldHideTooltip value={katanaApr} symbol={'percent'} decimals={6} />
        </>
      )
    }

    if (data.mode === 'rewards') {
      if (isVeYfi && data.estAprRange) {
        return (
          <>
            <span>{'⚡️ '}</span>
            <RenderAmount shouldHideTooltip value={data.estAprRange[0]} symbol={'percent'} decimals={6} />
            <span>{' → '}</span>
            <RenderAmount shouldHideTooltip value={data.estAprRange[1]} symbol={'percent'} decimals={6} />
          </>
        )
      }

      return (
        <>
          <span>{'⚡️ '}</span>
          <RenderAmount shouldHideTooltip value={boostedApr} symbol={'percent'} decimals={6} />
        </>
      )
    }

    if (data.mode === 'boosted' && data.isBoosted) {
      return (
        <>
          <span>{'🚀 '}</span>
          <RenderAmount shouldHideTooltip value={vault.apr.forwardAPR.netAPR} symbol={'percent'} decimals={6} />
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
          <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
        </>
      )
    }

    return (
      <>
        <span>{'Hist. '}</span>
        <RenderAmount shouldHideTooltip value={data.netApr} symbol={'percent'} decimals={6} />
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
          'relative z-10 flex w-full min-w-0 items-center gap-2 rounded-lg bg-[#2a1956eb]/50 px-3 py-2 text-xs text-text-primary backdrop-blur-lg'
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
            <div className={'truncate text-left text-sm font-semibold text-text-primary'}>{vault.name}</div>
          </div>
          <div className={'flex flex-row items-center gap-1 text-xs text-text-primary'}> {apyContent} </div>
        </div>
      </div>
    </div>
  )
}

export default HoldingsPill
