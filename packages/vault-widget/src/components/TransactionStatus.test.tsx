import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { VaultWidgetExecutionState, VaultWidgetExecutionStep } from '../types'
import { TransactionStatus } from './TransactionStatus'

const step: VaultWidgetExecutionStep = {
  id: 'claim',
  kind: 'execute',
  label: 'Claim rewards'
}

function render(execution: VaultWidgetExecutionState): string {
  return renderToStaticMarkup(<TransactionStatus execution={execution} />)
}

describe('TransactionStatus', () => {
  it('announces wallet confirmation and step progress', () => {
    const markup = render({
      status: 'confirming',
      step,
      stepCount: 2,
      stepIndex: 0
    })

    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('Confirm in your wallet')
    expect(markup).toContain('Claim rewards (1/2)')
  })

  it('distinguishes pending Safe proposals', () => {
    const markup = render({
      status: 'pending',
      step,
      stepCount: 2,
      stepIndex: 0,
      proposalId: '0x1234'
    })

    expect(markup).toContain('Safe proposal pending')
  })

  it('renders success and error states with the correct live-region roles', () => {
    expect(render({ status: 'success' })).toContain('role="status"')
    expect(render({ status: 'error', error: new Error('Claim reverted') })).toContain(
      '<div class="yv-widget__notice yv-widget__notice--error" role="alert">Claim reverted</div>'
    )
  })

  it('renders no status before execution begins', () => {
    expect(render({ status: 'idle' })).toBe('')
  })
})
