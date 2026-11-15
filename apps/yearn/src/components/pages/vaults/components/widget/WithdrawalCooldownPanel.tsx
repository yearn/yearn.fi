import { InfoOverlay } from '@yearn/vault-widget/advanced'
import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'

type Props = {
  title: string
  cooldownDuration: string
  withdrawalWindow?: string
  info: ReactNode
  children: ReactNode
  actions?: ReactNode
}

export function WithdrawalCooldownPanel({
  title,
  cooldownDuration,
  withdrawalWindow,
  info,
  children,
  actions
}: Props): ReactElement {
  const [isInfoOpen, setIsInfoOpen] = useState(false)

  return (
    <div className="rounded-lg border border-primary/80 bg-surface-tertiary/80 mt-3 p-4 text-sm text-text-primary">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-text-primary">{title}</p>
          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            className="text-xs font-medium text-text-secondary underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:text-text-primary hover:decoration-neutral-600"
          >
            {'more info'}
          </button>
        </div>
        <p className="text-sm text-text-primary/70">
          {`Cooldown: ${cooldownDuration}`}
          {withdrawalWindow ? ` | Withdrawal window: ${withdrawalWindow}` : null}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-sm text-text-primary/70">{children}</div>
      {actions}
      <InfoOverlay isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} title="Cooldown info">
        <div className="space-y-3 text-sm text-text-secondary">{info}</div>
      </InfoOverlay>
    </div>
  )
}

export function WithdrawalCooldownStatus({
  remaining,
  windowRemaining
}: {
  remaining: ReactNode
  windowRemaining: string
}): ReactElement {
  return (
    <>
      <p className="flex items-center gap-2">
        <span>{'Cooldown remaining:'}</span>
        {remaining}
      </p>
      <p>{`Withdrawal window remaining: ${windowRemaining}`}</p>
    </>
  )
}
