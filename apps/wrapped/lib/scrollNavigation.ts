export type TScrollGesture = { at: number; delta: number; locked: boolean }
export const initialScrollGesture: TScrollGesture = { at: 0, delta: 0, locked: false }

export function advanceScrollGesture(previous: TScrollGesture, delta: number, now: number) {
  const reset = now - previous.at > 180 || Math.sign(delta) !== Math.sign(previous.delta)
  const gesture = { at: now, delta: reset ? delta : previous.delta + delta, locked: !reset && previous.locked }
  if (gesture.locked || Math.abs(gesture.delta) < 64) return { gesture, step: 0 }
  return { gesture: { ...gesture, locked: true }, step: Math.sign(gesture.delta) }
}

export function canScrollWithin(target: Element | null, boundary: Element, direction: number): boolean {
  if (!target || target === boundary) return false
  const scrolls =
    /auto|scroll/.test(getComputedStyle(target).overflowY) && target.scrollHeight > target.clientHeight + 1
  const hasRoom =
    direction > 0 ? target.scrollTop + target.clientHeight < target.scrollHeight - 1 : target.scrollTop > 1
  return (scrolls && hasRoom) || canScrollWithin(target.parentElement, boundary, direction)
}
