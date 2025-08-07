import { Tooltip } from '@lib/components/Tooltip'

import type { FC } from 'react'

export const VAULT_RISK_COLORS = [
  'transparent',
  '#63C532',
  '#F8A908',
  '#F8A908',
  '#C73203',
  '#C73203'
]

export const VaultRiskScoreTag: FC<{ riskLevel: number }> = ({ riskLevel }) => {
  const level = riskLevel < 0 ? 0 : riskLevel > 5 ? 5 : riskLevel

  return (
    <div
      className={
        'col-span-3 flex flex-row items-end justify-between md:flex-col md:justify-center md:pt-4'
      }>
      <p className={'inline whitespace-nowrap text-start text-xs text-neutral-800/60 md:hidden'}>
        {'Risk Score'}
      </p>
      <Tooltip
        tooltip={
          <div
            className={
              'font-number relative rounded border border-neutral-300 bg-neutral-200 p-1 px-2 text-center text-xxs text-neutral-900 shadow-lg'
            }>
            <p>
              <b className={'text-xs font-semibold'}>{`${level} / 5 :`}</b>
              {
                " This reflects the vault's security, with 1 being most secure and 5 least secure, based on strategy complexity, loss exposure, and external dependencies."
              }
            </p>
          </div>
        }>
        <div
          className={'h-3 w-10 min-w-10 rounded-sm border border-neutral-300 p-[2px] '}
          style={{ borderWidth: '1px' }}>
          <div
            className={'h-1.5 rounded-[1px]'}
            style={{
              backgroundColor:
                VAULT_RISK_COLORS.length > level ? VAULT_RISK_COLORS[level] : VAULT_RISK_COLORS[0],
              width: `${(level / 5) * 100}%`
            }}
          />
        </div>
      </Tooltip>
    </div>
  )
}
