import { describe, expect, it, vi } from 'vitest'
import { refreshEnsoReadiness } from './ensoReadiness'

describe('refreshEnsoReadiness', () => {
  it('refreshes allowance before preparing the next Enso route', async () => {
    const callOrder: string[] = []
    const refetchAllowance = vi.fn(async () => {
      callOrder.push('allowance')
    })
    const refetchRoute = vi.fn(async () => {
      callOrder.push('route')
    })

    await refreshEnsoReadiness(refetchAllowance, refetchRoute)

    expect(callOrder).toEqual(['allowance', 'route'])
  })
})
