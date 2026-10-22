import type { Metadata } from 'next'
import { RetailEarn } from '@/components/earn/RetailEarn'

export const metadata: Metadata = {
  title: 'Earn on USDC | Yearn',
  description: 'Deposit USDC into Yearn Earn and target a fixed annual rate without selecting or rolling a maturity.'
}

export default function HomePage() {
  return <RetailEarn />
}
