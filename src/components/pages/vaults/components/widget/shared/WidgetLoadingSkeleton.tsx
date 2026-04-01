import { WidgetHeader } from '@pages/vaults/components/widget/shared/WidgetHeader'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'

type TWidgetLoadingSkeletonProps = {
  title: string
  actions?: ReactNode
  disableBorderRadius?: boolean
}

export function WidgetLoadingSkeleton({
  title,
  actions,
  disableBorderRadius
}: TWidgetLoadingSkeletonProps): ReactElement {
  return (
    <div className={cl('flex flex-col border border-border relative h-full', { 'rounded-lg': !disableBorderRadius })}>
      <WidgetHeader title={title} actions={actions} />
      <div className="flex items-center justify-center flex-1 p-6">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    </div>
  )
}
