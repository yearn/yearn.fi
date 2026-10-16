import type { Metadata } from 'next'
import { InstitutionsEarn } from '@/components/earn/InstitutionsEarn'

export const metadata: Metadata = {
  title: 'Earn for Institutions | Yearn',
  description:
    'Review live yTranche capital structure, supporting-capital ratios, coverage, operations, contracts, and diligence sources.'
}

export default function InstitutionsPage() {
  return <InstitutionsEarn />
}
