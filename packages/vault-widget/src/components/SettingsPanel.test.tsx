// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultWidgetSettings } from '../services'
import { SettingsPanel } from './SettingsPanel'

const settings: VaultWidgetSettings = {
  autoStake: true,
  maxLossBps: 100,
  slippagePercent: 0.5,
  solver: 'enso'
}

describe('SettingsPanel', () => {
  it('saves a valid slippage change when Escape closes the panel', () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<SettingsPanel onChange={onChange} onClose={onClose} settings={settings} title="Transaction Settings" />)

    fireEvent.click(screen.getByRole('button', { name: '0.1%' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onChange).toHaveBeenCalledWith({ ...settings, slippagePercent: 0.1 })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not save a high tolerance without the exact acknowledgement', () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<SettingsPanel onChange={onChange} onClose={onClose} settings={settings} title="Transaction Settings" />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } })
    expect(screen.getByText('Sentence does not match exactly.')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onChange).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('exposes auto-staking as an accessible switch', () => {
    const onChange = vi.fn()
    render(<SettingsPanel onChange={onChange} onClose={vi.fn()} settings={settings} title="Transaction Settings" />)

    const toggle = screen.getByRole('switch', { name: 'Stake Automatically' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith({ ...settings, autoStake: false })
  })
})
