import type { ReactElement, ReactNode } from 'react'

type WidgetHeaderProps = {
  title: string
  actions?: ReactNode
}

export function WidgetHeader({ title, actions }: WidgetHeaderProps): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 px-6 pt-3 min-h-12">
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
