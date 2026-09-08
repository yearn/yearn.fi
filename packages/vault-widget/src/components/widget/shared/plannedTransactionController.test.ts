import { getPlannedTransactionErrorPresentation } from '@yearn/vault-widget/internal/components/widget/shared/plannedTransactionController'
import { describe, expect, it } from 'vitest'

describe('legacy transaction error presentation', () => {
  it.each(['confirmed-refresh', 'submitted-unconfirmed', 'replaced'] as const)(
    'does not offer resubmission for %s',
    (kind) => {
      expect(getPlannedTransactionErrorPresentation(kind)).toMatchObject({ canRetry: false, actionLabel: 'Close' })
    }
  )
  it('retains confirmation when a legacy balance refresh fails', () => {
    expect(getPlannedTransactionErrorPresentation('confirmed-refresh').title).toBe('Transaction confirmed')
  })
})
