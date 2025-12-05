import Link from '@components/Link'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { toAddress } from '@lib/utils'
import { formatPercent } from '@lib/utils/format'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

type TAprDisplay =
  | {
      type: 'value'
      prefix?: string
      value: number
    }
  | {
      type: 'range'
      prefix?: string
      range: [number, number]
    }

export function SuggestedVaultCard({ vault }: { vault: TYDaemonVault }): ReactElement {
  const apyData = useVaultApyData(vault)
  const aprDisplay = useMemo<TAprDisplay>(() => {
    const isVeYfi = vault.staking.source === 'VeYFI'
    const boostedApr = apyData.baseForwardApr + apyData.rewardsAprSum
    if (apyData.mode === 'katana' && apyData.katanaTotalApr !== undefined) {
      return { type: 'value', prefix: '⚔️', value: apyData.katanaTotalApr }
    }
    if (apyData.mode === 'rewards') {
      if (isVeYfi && apyData.estAprRange) {
        return { type: 'range', prefix: '⚡️', range: apyData.estAprRange }
      }
      return { type: 'value', prefix: '⚡️', value: boostedApr }
    }
    if (apyData.mode === 'boosted' && apyData.isBoosted) {
      return { type: 'value', prefix: '🚀', value: apyData.baseForwardApr }
    }
    if (apyData.baseForwardApr !== 0) {
      return { type: 'value', value: apyData.baseForwardApr }
    }
    return { type: 'value', prefix: 'Hist.', value: apyData.netApr }
  }, [apyData, vault])

  const chain = getNetwork(vault.chainID)
  const tokenIcon = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${toAddress(
    vault.token.address
  ).toLowerCase()}/logo-128.png`

  const renderAprValue = (): string => {
    if (aprDisplay.type === 'range') {
      return `${formatPercent(aprDisplay.range[0] * 100, 2, 2)} – ${formatPercent(aprDisplay.range[1] * 100, 2, 2)}`
    }
    return formatPercent(aprDisplay.value * 100, 2, 2)
  }

  return (
    <Link
      to={`/vaults-beta/${vault.chainID}/${toAddress(vault.address)}`}
      className={
        'group flex h-full flex-col mr-4 rounded-md border border-neutral-200 vaults-card p-4 shadow-[0_12px_32px_rgba(4,8,32,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(4,8,32,0.12)]'
      }
    >
      <div className={'flex items-center gap-3'}>
        <div className={'shrink-0'}>
          <ImageWithFallback src={tokenIcon} alt={vault.token.symbol || ''} width={36} height={36} />
        </div>
        <div className={'flex flex-col'}>
          <p className={'text-base font-semibold text-neutral-900'}>{vault.name}</p>
          <p className={'text-xs text-neutral-600'}>
            {chain.name} • {vault.category}
          </p>
        </div>
      </div>
      <div className={'mt-4 flex items-end justify-between gap-4'}>
        <div>
          <p className={'text-xs font-semibold uppercase tracking-wide text-neutral-500'}>{'Est. APY'}</p>
          <p className={'mt-1 text-2xl font-bold text-neutral-900'}>
            {aprDisplay.prefix ? `${aprDisplay.prefix} ` : ''}
            {renderAprValue()}
          </p>
        </div>
        <div className={'text-right'}>
          <p className={'text-xs font-semibold uppercase tracking-wide text-neutral-500'}>{'TVL'}</p>
          <p className={'mt-1 text-lg font-semibold text-neutral-900'}>
            <RenderAmount
              value={vault.tvl?.tvl || 0}
              symbol={'USD'}
              decimals={0}
              options={{ shouldCompactValue: true, maximumFractionDigits: 2, minimumFractionDigits: 0 }}
            />
          </p>
        </div>
      </div>
      {/* <div
        className={
          'mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0657F9] transition-colors group-hover:text-[#0543c0]'
        }
      >
        <span>{'View vault'}</span>
        <span aria-hidden>{'→'}</span>
      </div> */}
    </Link>
  )
}
