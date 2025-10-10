import { RenderAmount } from '@lib/components/RenderAmount'
import { formatAmount, isZero, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import type { ReactElement, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

function HoldingsPill({ vault }: { vault: TYDaemonVault }): ReactElement {
  const data = useVaultApyData(vault)
  const navigate = useNavigate()
  const href = `/v3/${vault.chainID}/${toAddress(vault.address)}`

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
            <span className={'text-[0.65rem] uppercase tracking-wide text-neutral-100/70'}>
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

  return (
    <button
      type={'button'}
      onClick={(): void => {
        void navigate(href)
      }}
      className={'relative w-35'}
    >
      <div
      // className={
      //   'pointer-events-none absolute -inset-[3px]  bg-[radial-gradient(circle_at_top_left,rgba(210,17,98,.75),rgba(44,61,166,.75))] opacity-70 blur-md'
      // }
      />
      <div
        className={
          'relative z-10 flex w-full min-w-0 items-start gap-2 bg-[#2a1956eb] px-3 py-2 text-xs text-neutral-50 backdrop-blur-lg transition-colors hover:bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
        }
      >
        <div className={'flex w-full min-w-0 flex-col items-start'}>
          <div className={'w-full truncate text-left text-sm font-semibold text-neutral-50'}>{vault.name}</div>
          <div className={'flex flex-row items-center gap-1 text-xs text-neutral-50'}> {apyContent} </div>
        </div>
      </div>
    </button>
  )
}

export default HoldingsPill
