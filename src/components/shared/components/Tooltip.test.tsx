// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('delays opening when openDelayMs is set', () => {
    vi.useFakeTimers()
    const { container, queryByText } = render(
      <Tooltip tooltip={<div>Tip</div>} openDelayMs={150}>
        <button type="button">Trigger</button>
      </Tooltip>
    )

    const trigger = container.firstChild as HTMLElement
    fireEvent.mouseEnter(trigger)
    expect(queryByText('Tip')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(queryByText('Tip')).not.toBeNull()
    vi.useRealTimers()
  })

  it('toggles on click when toggleOnClick is true', () => {
    const { container, queryByText } = render(
      <Tooltip tooltip={<div>Tip</div>} toggleOnClick>
        <button type="button">Trigger</button>
      </Tooltip>
    )

    const trigger = container.firstChild as HTMLElement
    fireEvent.click(trigger)
    expect(queryByText('Tip')).not.toBeNull()
    fireEvent.click(trigger)
    expect(queryByText('Tip')).toBeNull()
  })
})
