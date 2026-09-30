import StatusPage from '@pages/status'
import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import { getSiteHealth } from '@/server/status'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'System Status',
  description: 'Live availability for Yearn services and supported networks.',
  alternates: {
    canonical: '/status',
    types: {
      'application/json': [{ title: 'Yearn system status JSON', url: 'https://yearn.fi/api/status' }]
    }
  },
  openGraph: {
    title: 'Yearn System Status',
    description: 'Live availability for Yearn services and supported networks.',
    url: '/status',
    type: 'website'
  }
}

export default async function Page(): Promise<ReactElement> {
  const health = await getSiteHealth()

  return <StatusPage initialHealth={health} />
}
