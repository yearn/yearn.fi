import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

export function PortfolioOverview({
  chart,
  metrics,
  allowOverflow = false
}: {
  chart: ReactElement
  metrics: ReactElement
  allowOverflow?: boolean
}): ReactElement {
  return (
    <div
      className={cl(
        'rounded-lg border border-border bg-surface shadow-[0_1px_0_rgba(15,23,42,0.02)]',
        allowOverflow ? 'overflow-visible' : 'overflow-hidden'
      )}
    >
      <div className="grid items-stretch min-[920px]:grid-cols-[minmax(640px,1fr)_minmax(200px,340px)]">
        <div className="min-w-0 rounded-t-lg bg-linear-to-b from-surface to-surface-secondary/20 min-[920px]:rounded-tr-none min-[920px]:rounded-bl-lg">
          {chart}
        </div>
        <div className="overflow-hidden rounded-b-lg border-t border-border bg-linear-to-b from-surface to-surface-secondary/25 min-[920px]:rounded-tr-lg min-[920px]:rounded-bl-none min-[920px]:border-t-0 min-[920px]:border-l">
          {metrics}
        </div>
      </div>
    </div>
  )
}
