import { buildIconUsageMap } from '@pages/icon-list/sourceUsage'
import { redirect } from 'next/navigation'
import type { ReactElement } from 'react'
import PublicApp from '@/PublicApp'
import IconListPageClient from './page-client'

export default async function Page(): Promise<ReactElement> {
  if (process.env.NODE_ENV === 'production') {
    redirect('/')
  }

  const usageMap = await buildIconUsageMap()

  return (
    <PublicApp>
      <IconListPageClient usageMap={usageMap} />
    </PublicApp>
  )
}
