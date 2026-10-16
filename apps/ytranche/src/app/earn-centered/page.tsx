import type { Metadata } from 'next'
import { RetailEarn } from '@/components/earn/RetailEarn'

export const metadata: Metadata = {
  title: 'Earn on USDC — Centered | Yearn',
  description: 'A centered Yearn Earn concept with the USDC deposit widget at the top of the experience.'
}

export default function CenteredEarnPage() {
  return <RetailEarn layout="centered" />
}
