import type { FC, ReactNode } from 'react'

export const WidgetHeader: FC<{ title: string; actions?: ReactNode }> = ({ title, actions }) => (
  <div className="flex items-center justify-between gap-3 px-6 pt-4">
    <h3 className="text-base font-semibold text-text-primary">{title}</h3>
    {actions ? <div className="shrink-0">{actions}</div> : null}
  </div>
)
