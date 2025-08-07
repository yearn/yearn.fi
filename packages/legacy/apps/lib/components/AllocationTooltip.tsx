import { cl } from '@lib/utils/cl'
import { usePathname } from 'next/navigation'

import type { ReactNode } from 'react'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'

export function AllocationTooltip({
  active,
  payload
}: {
  active: boolean
  payload: Payload<ValueType, NameType>[] | undefined
}): ReactNode {
  const pathname = usePathname()
  const isV3Page = pathname.includes('/v3')

  if (active && payload?.length) {
    const data = payload[0].payload
    return (
      <div
        className={cl(
          'min-w-[180px] p-2 shadow-lg text-neutral-900',
          isV3Page ? 'bg-neutral-300' : 'bg-neutral-900 dark:bg-neutral-300'
        )}
      >
        <p className={'text-sm font-medium'}>{data.name}</p>
        {data.value && (
          <div className={'mt-1 flex justify-between text-xs'}>
            <span>{data.name === 'Unallocated' ? 'Percentage:' : 'Allocation:'}</span>
            <span>
              {data.value.toFixed(2)}
              {'%'}
            </span>
          </div>
        )}
        {data.amount && (
          <div className={'flex justify-between text-xs'}>
            <span>{'Amount:'}</span>
            <span>{data.amount}</span>
          </div>
        )}
      </div>
    )
  }
  return null
}
