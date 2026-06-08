// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Tooltip } from './Tooltip'

function hover(element: HTMLElement): void {
  fireEvent.mouseEnter(element)
}

function click(element: HTMLElement): void {
  fireEvent.click(element)
}

describe('Tooltip', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })
  })

  it('delays opening when openDelayMs is set', () => {
    vi.useFakeTimers()
    const { container, queryByText } = render(
      <Tooltip tooltip={<div>Tip</div>} openDelayMs={150}>
        <button type="button">Trigger</button>
      </Tooltip>
    )

    const trigger = container.firstChild as HTMLElement
    act(() => {
      hover(trigger)
    })
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
    act(() => {
      click(trigger)
    })
    expect(queryByText('Tip')).not.toBeNull()
    act(() => {
      click(trigger)
    })
    expect(queryByText('Tip')).toBeNull()
  })

  it('does not open on hover on devices without hover support', () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    try {
      const { container, queryByText } = render(
        <Tooltip tooltip={<div>Tip</div>}>
          <button type="button">Trigger</button>
        </Tooltip>
      )

      const trigger = container.firstChild as HTMLElement
      hover(trigger)
      expect(queryByText('Tip')).toBeNull()
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: originalMatchMedia
      })
    }
  })
})
