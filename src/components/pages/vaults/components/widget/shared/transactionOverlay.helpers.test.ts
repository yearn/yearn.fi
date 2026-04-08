import { describe, expect, it } from 'vitest'
import { getInitialOverlayState } from './transactionOverlay.helpers'

describe('transactionOverlay helpers', () => {
  it('starts idle so conditionally mounted overlays can execute their first step on open', () => {
    expect(getInitialOverlayState()).toBe('idle')
  })
})
