'use client'

import type { TUsageMap } from '@pages/icon-list/data'
import IconListPage from '@pages/icon-list/index'
import type { ReactElement } from 'react'

export default function IconListPageClient({ usageMap }: { usageMap: TUsageMap }): ReactElement {
  return <IconListPage usageMap={usageMap} />
}
