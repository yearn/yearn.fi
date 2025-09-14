import type { TGraphData } from '@lib/types'
import { formatAmount, formatWithUnit, isZero } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'

import type { ReactElement } from 'react'
import { Fragment, useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type TGraphForVaultEarningsProps = {
  currentVault: TYDaemonVault
  harvestData: TGraphData[]
  height?: number
  isCumulative?: boolean
}

export function GraphForVaultEarnings({
  currentVault,
  harvestData,
  height = 312,
  isCumulative = true
}: TGraphForVaultEarningsProps): ReactElement {
  const cumulativeData = useMemo((): { name: string; value: number }[] => {
    let cumulativeValue = 0
    return harvestData.map((item: { name: string; value: number }): { name: string; value: number } => {
      cumulativeValue += item.value
      return {
        name: item.name,
        value: cumulativeValue
      }
    })
  }, [harvestData])

  if (isCumulative && isZero(cumulativeData?.length)) {
    return <Fragment />
  }
  if (!isCumulative && isZero(harvestData?.length)) {
    return <Fragment />
  }
  return (
    <ResponsiveContainer width={'100%'} height={height}>
      <LineChart margin={{ top: 0, right: -28, bottom: 0, left: 0 }} data={isCumulative ? cumulativeData : harvestData}>
        <Line
          type={'step'}
          dot={false}
          activeDot={(e: any): ReactElement<SVGElement> => {
            const dotProps = e as unknown as React.SVGProps<SVGCircleElement> & { dataKey?: string }
            dotProps.className = `${dotProps.className} activeDot`
            delete dotProps.dataKey
            return <circle {...dotProps}></circle>
          }}
          strokeWidth={2}
          dataKey={'value'}
          stroke={'currentcolor'}
        />
        <XAxis dataKey={'name'} hide />
        <YAxis
          orientation={'right'}
          domain={['dataMin', 'auto']}
          hide={false}
          tick={(props): React.ReactElement<SVGElement> => {
            const {
              payload: { value }
            } = props
            props.fill = '#5B5B5B'
            props.className = 'text-xxs md:text-xs font-number'
            props.alignmentBaseline = 'middle'
            delete props.verticalAnchor
            delete props.visibleTicksCount
            delete props.tickFormatter
            const formatedValue = formatWithUnit(value, 0, 0)
            return <text {...props}>{formatedValue}</text>
          }}
        />
        <Tooltip
          content={(e): ReactElement => {
            const { active: isTooltipActive, payload, label } = e
            if (!isTooltipActive || !payload) {
              return <Fragment />
            }
            if (payload.length > 0) {
              const [{ value }] = payload

              return (
                <div className={'recharts-tooltip w-48'}>
                  <div className={'mb-4'}>
                    <p className={'text-xs'}>{label}</p>
                  </div>
                  <div className={'flex flex-row items-center flex-wrap justify-between'}>
                    <p className={'text-xs text-neutral-600'}>{'Earnings'}</p>
                    <b className={'font-number text-xs font-bold text-neutral-900'}>
                      {`${formatAmount(Number(value))} ${currentVault.token.symbol}`}
                    </b>
                  </div>
                </div>
              )
            }
            return <div />
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
