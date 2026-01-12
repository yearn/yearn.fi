import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useState } from 'react'

export function VaultRiskScoreTag({
  riskLevel,
  onMobileToggle,
  className,
  variant = 'default'
}: {
  riskLevel: number
  onMobileToggle?: (e: React.MouseEvent) => void
  className?: string
  variant?: 'default' | 'inline'
}): ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false)
  const level = riskLevel < 0 ? 0 : riskLevel > 5 ? 5 : riskLevel
  const riskColor = ['transparent', '#63C532', '#F8A908', '#F8A908', '#C73203', '#C73203']
  const handleToggle = (e: React.MouseEvent): void => {
    if (variant === 'inline') {
      return
    }
    e.stopPropagation()
    if (onMobileToggle) {
      onMobileToggle(e)
      return
    }
    setMobileOpen((v) => !v)
  }
  const rootClasses = variant === 'inline' ? 'flex items-center' : 'col-span-2 w-full md:pt-1'
  const contentClasses =
    variant === 'inline' ? 'flex flex-row items-center gap-3' : 'flex flex-row items-end justify-between md:flex-col'
  const onClick = variant === 'inline' ? undefined : handleToggle

  return (
    <div className={cl(rootClasses, className)}>
      <div className={contentClasses}>
        {variant === 'inline' ? null : (
          <p className={'inline whitespace-nowrap text-start text-xs text-text-primary/60 md:hidden'}>{'Risk Score'}</p>
        )}
        <div
          className={cl('flex w-fit items-center justify-end gap-4 md:justify-center', 'tooltip relative z-5 h-6')}
          onClick={onClick}
        >
          <div className={'h-3 w-10 min-w-10 rounded-xs border-2 border-border-hover p-[2px]'}>
            <div
              className={'h-1 rounded-[1px]'}
              style={{
                backgroundColor: riskColor.length > level ? riskColor[level] : riskColor[0],
                width: `${(level / 5) * 100}%`
              }}
            />
          </div>
          <span
            suppressHydrationWarning
            className={'tooltiptext top-full mt-1 !text-[10px]'}
            style={{ marginRight: 'calc(-94px + 50%)' }}
          >
            <div
              className={
                'font-number relative border border-border bg-surface-secondary p-1 px-2 text-center text-text-primary'
              }
            >
              <p>
                <b className={'font-semibold'}>{`${level} / 5 :`}</b>
                {
                  " This reflects the vault's security, with 1 being most secure and 5 least secure, based on strategy complexity, loss exposure, and external dependencies."
                }
              </p>
            </div>
          </span>
        </div>
      </div>
      {variant === 'inline' || onMobileToggle ? null : mobileOpen ? (
        <RiskScoreInlineDetails riskLevel={riskLevel} />
      ) : null}
    </div>
  )
}

export function RiskScoreInlineDetails({ riskLevel }: { riskLevel: number }): ReactElement {
  const level = riskLevel < 0 ? 0 : riskLevel > 5 ? 5 : riskLevel
  return (
    <div
      className={'md:hidden mt-2 w-full rounded-xl border border-border bg-surface-secondary p-3 text-text-primary'}
      onClick={(e): void => e.stopPropagation()}
    >
      <div className={'flex flex-col gap-2'}>
        <div className={'flex items-center justify-between'}>
          <p className={'text-xs text-text-primary'}>{'Level'}</p>
          <span className={'font-number text-xs'}>{`${level} / 5`}</span>
        </div>
        <div className={'my-1 h-px w-full bg-surface-tertiary/60'} />
        <p className={'text-xs text-text-primary'}>
          {
            "This reflects the vault's security, with 1 being most secure and 5 least secure, based on strategy complexity, loss exposure, and external dependencies."
          }
        </p>
      </div>
    </div>
  )
}
