import { advanceScrollGesture, initialScrollGesture } from '@wrapped/lib/scrollNavigation'
import { describe, expect, it } from 'vitest'

describe('scroll navigation gestures', () => {
  it('accumulates small trackpad movement before advancing one card', () => {
    const first = advanceScrollGesture(initialScrollGesture, 20, 1000)
    const second = advanceScrollGesture(first.gesture, 25, 1010)
    expect(first.step).toBe(0)
    expect(second.step).toBe(0)
    expect(advanceScrollGesture(second.gesture, 25, 1020).step).toBe(1)
  })
  it('does not skip cards as momentum continues from one gesture', () => {
    const first = advanceScrollGesture(initialScrollGesture, 100, 1000)
    const momentum = advanceScrollGesture(first.gesture, 600, 1050)
    expect(first.step).toBe(1)
    expect(momentum.step).toBe(0)
    expect(advanceScrollGesture(momentum.gesture, 300, 1100).step).toBe(0)
  })
  it('allows another card after the previous gesture ends', () => {
    const first = advanceScrollGesture(initialScrollGesture, 100, 1000)
    expect(advanceScrollGesture(first.gesture, 100, 1250).step).toBe(1)
  })
  it('allows reversing direction immediately without accumulating opposite movements', () => {
    const first = advanceScrollGesture(initialScrollGesture, 100, 1000)
    const reverse = advanceScrollGesture(first.gesture, -20, 1010)
    expect(reverse.step).toBe(0)
    expect(advanceScrollGesture(reverse.gesture, -60, 1020).step).toBe(-1)
  })
})
