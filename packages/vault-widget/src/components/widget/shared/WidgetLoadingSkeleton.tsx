import { WidgetHeader } from '@yearn/vault-widget/internal/components/widget/shared/WidgetHeader'
import { cl } from '@yearn/vault-widget/internal/utils/index'
import type { ReactElement, ReactNode } from 'react'

type TWidgetLoadingSkeletonProps = {
  title: string
  actions?: ReactNode
  disableBorderRadius?: boolean
  hideHeader?: boolean
}

export function WidgetLoadingSkeleton({
  title,
  actions,
  disableBorderRadius,
  hideHeader
}: TWidgetLoadingSkeletonProps): ReactElement {
  return (
    <div className={cl('flex flex-col border border-border relative h-full', { 'rounded-lg': !disableBorderRadius })}>
      {!hideHeader && <WidgetHeader title={title} actions={actions} />}
      <div className="flex items-center justify-center flex-1 p-6">
        <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    </div>
  )
}
