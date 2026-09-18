import {
  createWidgetAnalytics,
  getBatchReason,
  type TWidgetAnalyticsContext,
  widgetErrorCategory
} from '@yearn/vault-widget/internal/utils/analytics'
import { describe, expect, it, vi } from 'vitest'

const context: TWidgetAnalyticsContext = {
  action: 'deposit',
  route: 'enso_zap_in',
  source_chain: 1,
  destination_chain: 1,
  batch_capability: 'supported',
  batch_reason: 'eligible',
  approval_required: true
}

describe('widget analytics', () => {
  it('tracks batch submission separately from confirmation and counts a retry once', () => {
    const track = vi.fn()
    const analytics = createWidgetAnalytics(() => track)
    analytics.open(context)
    const rejected = analytics.start('deposit-batch', { execution_mode: 'atomic_batch', call_count: 2 })
    analytics.result(rejected, 'rejected', 'rejected')
    const retry = analytics.start('deposit-batch', { execution_mode: 'atomic_batch', call_count: 2 })
    analytics.result(rejected, 'submitted')
    analytics.result(retry, 'submitted')
    expect(track.mock.calls.some(([event]) => event === 'widget_flow_result')).toBe(false)
    analytics.result(retry, 'confirmed')
    analytics.result(retry, 'confirmed')
    analytics.complete(retry, 'success')
    analytics.complete(retry, 'success')
    analytics.close()
    expect(
      track.mock.calls.filter(([event]) => event === 'widget_step_result').map(([, props]) => props.outcome)
    ).toEqual(['rejected', 'submitted', 'confirmed'])
    expect(track.mock.calls.filter(([event]) => event === 'widget_flow_result')).toEqual([
      [
        'widget_flow_result',
        expect.objectContaining({
          outcome: 'success',
          batch_used: true,
          retry_count: 1,
          step_count: 1,
          route: 'enso_zap_in'
        })
      ]
    ])
  })

  it('does not count approval followed by deposit as a retry', () => {
    const track = vi.fn()
    const analytics = createWidgetAnalytics(() => track)
    analytics.open(context)
    analytics.result(analytics.start('approve', { execution_mode: 'permit' }), 'signed')
    const deposit = analytics.start('deposit', { execution_mode: 'transaction' })
    analytics.result(deposit, 'confirmed')
    analytics.complete(deposit, 'success')
    expect(analytics.summary()).toMatchObject({
      retry_count: 0,
      step_count: 2,
      batch_used: false,
      execution_mode: 'transaction'
    })
  })

  it('keeps pending Safe and cross-chain flows unknown when observation stops', () => {
    const track = vi.fn()
    const analytics = createWidgetAnalytics(() => track)
    analytics.open({ ...context, destination_chain: 8453 })
    const attempt = analytics.start('deposit-batch', { execution_mode: 'safe_batch' })
    analytics.result(attempt, 'submitted')
    analytics.result(attempt, 'awaiting_execution')
    analytics.close()
    expect(track).toHaveBeenLastCalledWith(
      'widget_flow_result',
      expect.objectContaining({ outcome: 'pending_or_unknown' })
    )
    analytics.open(context)
    analytics.complete(attempt, 'success')
    expect(
      track.mock.calls.filter(([event, props]) => event === 'widget_flow_result' && props.outcome === 'success')
    ).toHaveLength(0)
  })

  it('freezes the flow and reporting callback, ignoring refresh errors after confirmation', () => {
    const first = vi.fn()
    const second = vi.fn()
    const sink = { track: first }
    const analytics = createWidgetAnalytics(() => sink.track)
    analytics.open(context)
    sink.track = second
    analytics.open({ ...context, route: 'direct_deposit' })
    const attempt = analytics.start('deposit', {})
    analytics.result(attempt, 'confirmed')
    analytics.result(attempt, 'error', 'refresh')
    analytics.complete(attempt, 'success')
    expect(second).not.toHaveBeenCalled()
    expect(first).toHaveBeenLastCalledWith(
      'widget_flow_result',
      expect.objectContaining({ route: 'enso_zap_in', outcome: 'success' })
    )
  })

  it('distinguishes capability failures from unsupported wallets and unnecessary approvals', () => {
    expect(getBatchReason({ approvalRequired: true, capability: 'error', hasBatch: false })).toBe('capability_error')
    expect(getBatchReason({ approvalRequired: true, capability: 'unsupported', hasBatch: false })).toBe(
      'wallet_unsupported'
    )
    expect(getBatchReason({ approvalRequired: false, capability: 'supported', hasBatch: false })).toBe(
      'approval_not_needed'
    )
    expect(widgetErrorCategory({ cause: { code: 5760 } })).toBe('unsupported_capability')
  })
})
