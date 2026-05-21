import { isTrustedEmbed } from '@shared/utils/helpers'
import { afterEach, describe, expect, it } from 'vitest'

type TMockWindow = {
  location: {
    ancestorOrigins?: string[]
  }
  self?: unknown
  top?: unknown
}

const originalWindow = globalThis.window
const originalDocument = globalThis.document

function mockBrowser({
  ancestorOrigins = [],
  isIframe = true,
  referrer = ''
}: {
  ancestorOrigins?: string[]
  isIframe?: boolean
  referrer?: string
}): void {
  const mockWindow: TMockWindow = {
    location: { ancestorOrigins }
  }

  mockWindow.self = mockWindow
  mockWindow.top = isIframe ? {} : mockWindow

  ;(globalThis as unknown as { window: TMockWindow }).window = mockWindow
  ;(globalThis as unknown as { document: { referrer: string; location: { ancestorOrigins: string[] } } }).document = {
    referrer,
    location: { ancestorOrigins }
  }
}

describe('isTrustedEmbed', () => {
  afterEach(() => {
    ;(globalThis as unknown as { window: typeof originalWindow }).window = originalWindow
    ;(globalThis as unknown as { document: typeof originalDocument }).document = originalDocument
  })

  it('returns false during server-side rendering', () => {
    ;(globalThis as unknown as { window: undefined }).window = undefined
    ;(globalThis as unknown as { document: undefined }).document = undefined

    expect(isTrustedEmbed()).toBe(false)
  })

  it('returns false in a top-level window', () => {
    mockBrowser({ isIframe: false, referrer: 'https://app.safe.global' })

    expect(isTrustedEmbed()).toBe(false)
  })

  it('returns false in a generic iframe', () => {
    mockBrowser({ ancestorOrigins: ['https://evil-safe.example'] })

    expect(isTrustedEmbed()).toBe(false)
  })

  it('returns true for an explicitly trusted ancestor origin', () => {
    mockBrowser({ ancestorOrigins: ['https://app.safe.global'] })

    expect(isTrustedEmbed()).toBe(true)
  })

  it('falls back to a trusted document referrer when ancestor origins are unavailable', () => {
    mockBrowser({ referrer: 'https://app.gnosis-safe.io/apps' })

    expect(isTrustedEmbed()).toBe(true)
  })

  it('returns false for malformed referrer data', () => {
    mockBrowser({ referrer: 'not a url' })

    expect(isTrustedEmbed()).toBe(false)
  })
})
