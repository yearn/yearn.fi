import { type TTranchedProductKind, YVUSD_JUNIOR_COOLDOWN_DAYS } from '@pages/vaults/constants/tranchedProducts'
import type { ReactElement } from 'react'

const trancheItems = {
  senior: ['5% Target APY', 'Lower risk, steady return', 'No lockups or cooldowns'],
  junior: ['No target APY', 'Higher risk, higher yield', `${YVUSD_JUNIOR_COOLDOWN_DAYS}-day withdrawal cooldown`]
}

export function YvUsdTrancheSummary({
  kind,
  onMoreInfo
}: {
  kind: TTranchedProductKind
  onMoreInfo?: () => void
}): ReactElement {
  return (
    <div className="rounded-lg border border-primary/80 bg-surface-tertiary/80 px-3 py-2 text-sm text-text-primary">
      {onMoreInfo ? (
        <div className="flex items-center gap-2 mb-2">
          <p className="font-semibold">{kind === 'senior' ? 'Senior vault' : 'Junior vault'}</p>
          <button
            type="button"
            onClick={onMoreInfo}
            className="text-xs font-medium text-text-secondary underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:text-text-primary hover:decoration-neutral-600"
          >
            {'more info'}
          </button>
        </div>
      ) : null}
      <ul className="list-disc space-y-1 pl-5">
        {trancheItems[kind].map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
