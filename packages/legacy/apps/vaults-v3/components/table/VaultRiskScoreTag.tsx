import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { ResponsivePopover } from '@vaults-v3/components/ui/ResponsivePopover'
import { InfoButton } from '@vaults-v3/components/ui/InfoButton'

export function VaultRiskScoreTag({ riskLevel }: { riskLevel: number }): ReactElement {
  const level = riskLevel < 0 ? 0 : riskLevel > 5 ? 5 : riskLevel
  const riskColor = ['transparent', '#63C532', '#F8A908', '#F8A908', '#C73203', '#C73203']
  return (
    <div className={'md:justify-centere col-span-2 flex flex-row items-end justify-between md:flex-col md:pt-4'}>
      <p className={'inline whitespace-nowrap text-start text-xs text-neutral-800/60 md:hidden'}>{'Risk Score'}</p>
      <div className={cl('flex w-fit items-center justify-end gap-2 md:gap-4 md:justify-center', 'relative z-50 h-6')}>
        <ResponsivePopover
          trigger={
            <div className={'hidden md:flex h-3 w-10 min-w-10 rounded-xs border-2 border-neutral-400 p-[2px]'}>
              <div
                className={'h-1 rounded-[1px] w-full'}
                style={{
                  backgroundColor: riskColor.length > level ? riskColor[level] : riskColor[0],
                  width: `${(level / 5) * 100}%`
                }}
              />
            </div>
          }
          mobileTrigger={<InfoButton />}
          mobileContent={
            <div className={'relative rounded-xl border border-neutral-300 bg-neutral-100 p-4 text-center text-neutral-900'}>
              <p>
                <b className={'font-semibold'}>
                  <span className={'font-number'}>{`${level} / 5`}</span>
                  {' :'}
                </b>
                {
                  " This reflects the vault's security, with 1 being most secure and 5 least secure, based on strategy complexity, loss exposure, and external dependencies."
                }
              </p>
            </div>
          }
        >
          <span suppressHydrationWarning className={'tooltiptext top-full mt-1 !text-[10px]'} style={{ marginRight: 'calc(-94px + 50%)' }}>
            <div className={'relative rounded-xl border border-neutral-300 bg-neutral-100 p-4 text-center text-neutral-900'}>
              <p>
                <b className={'font-semibold'}>
                  <span className={'font-number'}>{`${level} / 5`}</span>
                  {' :'}
                </b>
                {
                  " This reflects the vault's security, with 1 being most secure and 5 least secure, based on strategy complexity, loss exposure, and external dependencies."
                }
              </p>
            </div>
          </span>
        </ResponsivePopover>
        {/* Mobile-visible bar (non-interactive) */}
        <div className={'md:hidden h-3 w-10 min-w-10 rounded-xs border-2 border-neutral-400 p-[2px]'}>
          <div
            className={'h-1 rounded-[1px]'}
            style={{
              backgroundColor: riskColor.length > level ? riskColor[level] : riskColor[0],
              width: `${(level / 5) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  )
}
